import { Injectable } from '@nestjs/common';
import { MonitorType } from '@prisma/client';
import { IncidentsService } from '../../incidents/incidents.service';
import { RedisService } from '../../queue/redis.service';
import type { MonitorCheckJobPayload } from '../scheduler/scheduler.types';
import { MonitorCheckExecutorService } from './monitor-check-executor.service';
import { WorkerRepository } from './repositories/worker.repository';
import {
  getMonitorFailureCountKey,
  getMonitorFirstFailureAtKey,
  MONITOR_FAILURE_COUNTER_TTL_MS,
  type MonitorCheckProcessingResult,
} from './worker.types';

@Injectable()
export class MonitorCheckProcessorService {
  constructor(
    private readonly workerRepository: WorkerRepository,
    private readonly executorService: MonitorCheckExecutorService,
    private readonly incidentsService: IncidentsService,
    private readonly redisService: RedisService,
  ) {}

  async process(
    payload: MonitorCheckJobPayload,
  ): Promise<MonitorCheckProcessingResult> {
    const monitor = await this.workerRepository.findMonitorForExecution(payload.monitorId);

    if (!monitor || !monitor.isActive || monitor.type === MonitorType.HEARTBEAT) {
      return {
        processed: false,
        outcome: 'SKIPPED',
        monitorId: payload.monitorId,
        monitorType: monitor?.type ?? null,
        checkedAt: null,
        isUp: null,
        consecutiveFailures: 0,
        incidentId: null,
        error: !monitor
          ? 'Monitor not found'
          : !monitor.isActive
            ? 'Monitor is inactive'
            : 'Heartbeat monitors are not processed by monitor-checks',
      };
    }

    const executionResult = await this.executorService.execute(monitor);
    await this.workerRepository.recordCheckResult(monitor.id, executionResult);

    if (executionResult.isUp) {
      return this.handleSuccessfulCheck(monitor.id, monitor.type, executionResult.checkedAt);
    }

    return this.handleFailedCheck(
      monitor.id,
      monitor.type,
      executionResult.checkedAt,
      executionResult.error ?? 'Monitor check failed',
      monitor.consecutiveFailuresThreshold,
      monitor.intervalSeconds,
    );
  }

  private async handleSuccessfulCheck(
    monitorId: string,
    monitorType: MonitorType,
    checkedAt: Date,
  ): Promise<MonitorCheckProcessingResult> {
    const redis = await this.redisService.getConnectedClient();

    await redis.del(
      getMonitorFailureCountKey(monitorId),
      getMonitorFirstFailureAtKey(monitorId),
    );

    const resolvedIncident =
      await this.incidentsService.resolveOpenIncidentForMonitor({
        monitorId,
        resolvedAt: checkedAt,
      });

    return {
      processed: true,
      outcome: resolvedIncident ? 'RECOVERED' : 'UP',
      monitorId,
      monitorType,
      checkedAt: checkedAt.toISOString(),
      isUp: true,
      consecutiveFailures: 0,
      incidentId: resolvedIncident?.id ?? null,
      error: null,
    };
  }

  private async handleFailedCheck(
    monitorId: string,
    monitorType: MonitorType,
    checkedAt: Date,
    error: string,
    threshold: number,
    intervalSeconds: number,
  ): Promise<MonitorCheckProcessingResult> {
    const redis = await this.redisService.getConnectedClient();
    const normalizedThreshold = Math.max(threshold, 1);
    const counterKey = getMonitorFailureCountKey(monitorId);
    const firstFailureAtKey = getMonitorFirstFailureAtKey(monitorId);
    const ttlMs = Math.max(
      MONITOR_FAILURE_COUNTER_TTL_MS,
      intervalSeconds * 1000 * normalizedThreshold * 3,
    );
    const consecutiveFailures = await redis.incr(counterKey);

    await redis.pexpire(counterKey, ttlMs);

    if (consecutiveFailures === 1) {
      await redis.set(firstFailureAtKey, checkedAt.toISOString(), 'PX', ttlMs);
    } else {
      await redis.pexpire(firstFailureAtKey, ttlMs);
    }

    if (consecutiveFailures < normalizedThreshold) {
      return {
        processed: true,
        outcome: 'UNCONFIRMED_DOWN',
        monitorId,
        monitorType,
        checkedAt: checkedAt.toISOString(),
        isUp: false,
        consecutiveFailures,
        incidentId: null,
        error,
      };
    }

    const firstFailureAt = await redis.get(firstFailureAtKey);
    const startedAt = firstFailureAt ? new Date(firstFailureAt) : checkedAt;
    const incident = await this.incidentsService.openIncidentForMonitor({
      monitorId,
      cause: error,
      startedAt,
      confirmedAt: checkedAt,
    });

    return {
      processed: true,
      outcome: 'DOWN',
      monitorId,
      monitorType,
      checkedAt: checkedAt.toISOString(),
      isUp: false,
      consecutiveFailures,
      incidentId: incident.id,
      error,
    };
  }
}
