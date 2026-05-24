import { Injectable, NotFoundException } from '@nestjs/common';
import { MonitorType } from '@prisma/client';
import { IncidentsService } from '../incidents/incidents.service';
import { BullQueueService } from '../queue/bull-queue.service';
import {
  buildHeartbeatTimeoutPayload,
  getHeartbeatTimeoutJobId,
  HEARTBEAT_TIMEOUT_CAUSE,
  HEARTBEAT_TIMEOUT_JOB_NAME,
  type HeartbeatMonitorQueueTarget,
  type HeartbeatTimeoutJobPayload,
} from './heartbeat.types';
import { HeartbeatRepository } from './repositories/heartbeat.repository';

export interface HeartbeatPingResponse {
  message: string;
  monitorId: string;
  receivedAt: string;
  nextTimeoutAt: string;
}

@Injectable()
export class HeartbeatService {
  constructor(
    private readonly heartbeatRepository: HeartbeatRepository,
    private readonly incidentsService: IncidentsService,
    private readonly bullQueueService: BullQueueService,
  ) {}

  async ping(token: string): Promise<HeartbeatPingResponse> {
    const monitor = await this.heartbeatRepository.findActiveMonitorByToken(token);

    if (!monitor) {
      throw new NotFoundException('Heartbeat monitor not found');
    }

    const receivedAt = new Date();

    await this.heartbeatRepository.recordPing(monitor.id, receivedAt);
    await this.replaceTimeoutJob({
      monitorId: monitor.id,
      intervalSeconds: monitor.intervalSeconds,
      timeoutMs: monitor.timeoutMs,
      referenceTime: receivedAt,
    });
    await this.incidentsService.resolveOpenIncidentForMonitor({
      monitorId: monitor.id,
      resolvedAt: receivedAt,
    });

    const nextTimeoutPayload = buildHeartbeatTimeoutPayload({
      monitorId: monitor.id,
      intervalSeconds: monitor.intervalSeconds,
      timeoutMs: monitor.timeoutMs,
      referenceTime: receivedAt,
    });

    return {
      message: 'Heartbeat received',
      monitorId: monitor.id,
      receivedAt: receivedAt.toISOString(),
      nextTimeoutAt: nextTimeoutPayload.expectedBy,
    };
  }

  async syncMonitorTimeout(monitor: HeartbeatMonitorQueueTarget): Promise<void> {
    if (monitor.type !== MonitorType.HEARTBEAT || !monitor.isActive) {
      await this.removeTimeoutJob(monitor.id);
      return;
    }

    await this.replaceTimeoutJob({
      monitorId: monitor.id,
      intervalSeconds: monitor.intervalSeconds,
      timeoutMs: monitor.timeoutMs,
      referenceTime: monitor.lastCheckedAt ?? monitor.updatedAt ?? monitor.createdAt,
    });
  }

  async removeMonitorTimeout(monitorId: string): Promise<void> {
    await this.removeTimeoutJob(monitorId);
  }

  async processTimeoutJob(
    payload: HeartbeatTimeoutJobPayload,
  ): Promise<{
    expired: boolean;
    monitorId: string;
    incidentId: string | null;
  }> {
    const monitor = await this.heartbeatRepository.findHeartbeatMonitorById(
      payload.monitorId,
    );

    if (!monitor || !monitor.isActive) {
      return {
        expired: false,
        monitorId: payload.monitorId,
        incidentId: null,
      };
    }

    const expectedBy = new Date(payload.expectedBy);

    if (monitor.lastCheckedAt && monitor.lastCheckedAt >= expectedBy) {
      return {
        expired: false,
        monitorId: monitor.id,
        incidentId: null,
      };
    }

    await this.heartbeatRepository.recordTimeoutFailure(
      monitor.id,
      expectedBy,
      HEARTBEAT_TIMEOUT_CAUSE,
    );

    const incident = await this.incidentsService.openIncidentForMonitor({
      monitorId: monitor.id,
      cause: HEARTBEAT_TIMEOUT_CAUSE,
      startedAt: expectedBy,
      confirmedAt: expectedBy,
    });

    return {
      expired: true,
      monitorId: monitor.id,
      incidentId: incident.id,
    };
  }

  private async replaceTimeoutJob(params: {
    monitorId: string;
    intervalSeconds: number;
    timeoutMs: number;
    referenceTime: Date;
  }): Promise<void> {
    const payload = buildHeartbeatTimeoutPayload(params);
    const queue = this.bullQueueService.getQueue('heartbeat-timeout');
    const jobId = getHeartbeatTimeoutJobId(params.monitorId);
    const existingJob = await queue.getJob(jobId);

    if (existingJob) {
      await existingJob.remove();
    }

    const delay = Math.max(new Date(payload.expectedBy).getTime() - Date.now(), 0);

    await queue.add(HEARTBEAT_TIMEOUT_JOB_NAME, payload, {
      jobId,
      delay,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });
  }

  private async removeTimeoutJob(monitorId: string): Promise<void> {
    const queue = this.bullQueueService.getQueue('heartbeat-timeout');
    const job = await queue.getJob(getHeartbeatTimeoutJobId(monitorId));

    if (job) {
      await job.remove();
    }
  }
}
