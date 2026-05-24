import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MonitorType,
  type CheckResult,
  type Incident,
  type Monitor,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { HeartbeatService } from '../heartbeat/heartbeat.service';
import { PLAN_LIMITS } from '../users/constants/plan-limits';
import type { CreateMonitorDto } from './dto/create-monitor.dto';
import type { ListMonitorsQueryDto } from './dto/list-monitors-query.dto';
import type { UpdateMonitorDto } from './dto/update-monitor.dto';
import { MonitorsRepository } from './repositories/monitors.repository';

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginatedMeta;
}

export interface MonitorStatsResponse {
  monitorId: string;
  currentStatus: 'UP' | 'DOWN' | 'UNKNOWN';
  totalChecks: number;
  upChecks: number;
  downChecks: number;
  uptimePercentage: number | null;
  averageLatencyMs: number | null;
  latestCheckAt: string | null;
  totalIncidents: number;
}

type NormalizedMonitorPayload = {
  name: string;
  type: MonitorType;
  url: string | null;
  intervalSeconds: number;
  timeoutMs: number;
  isActive: boolean;
  keywordExpected: string | null;
  keywordMustExist: boolean | null;
  consecutiveFailuresThreshold: number;
  heartbeatToken: string | null;
};

@Injectable()
export class MonitorsService {
  constructor(
    private readonly monitorsRepository: MonitorsRepository,
    private readonly heartbeatService: HeartbeatService,
  ) {}

  async listMonitors(
    user: AuthenticatedUser,
    query: ListMonitorsQueryDto,
  ): Promise<PaginatedResponse<Monitor>> {
    const page = query.page;
    const limit = query.limit;
    const [items, total] = await Promise.all([
      this.monitorsRepository.findManyByUserId({
        userId: user.id,
        skip: (page - 1) * limit,
        take: limit,
        type: query.type,
        isActive: query.isActive,
      }),
      this.monitorsRepository.countVisibleByUserId({
        userId: user.id,
        type: query.type,
        isActive: query.isActive,
      }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async createMonitor(
    user: AuthenticatedUser,
    createMonitorDto: CreateMonitorDto,
  ): Promise<Monitor> {
    const currentCount = await this.monitorsRepository.countByUserId(user.id);
    const limits = PLAN_LIMITS[user.plan];

    if (currentCount >= limits.maxMonitors) {
      throw new ConflictException(
        `Plan ${user.plan} only allows up to ${limits.maxMonitors} monitors`,
      );
    }

    const normalizedMonitor = this.normalizeMonitorInput(
      createMonitorDto,
      user.plan,
      null,
    );

    const monitor = await this.monitorsRepository.create({
      name: normalizedMonitor.name,
      type: normalizedMonitor.type,
      url: normalizedMonitor.url,
      intervalSeconds: normalizedMonitor.intervalSeconds,
      timeoutMs: normalizedMonitor.timeoutMs,
      isActive: normalizedMonitor.isActive,
      keywordExpected: normalizedMonitor.keywordExpected,
      keywordMustExist: normalizedMonitor.keywordMustExist,
      consecutiveFailuresThreshold: normalizedMonitor.consecutiveFailuresThreshold,
      heartbeatToken: normalizedMonitor.heartbeatToken,
      user: {
        connect: {
          id: user.id,
        },
      },
    });

    if (monitor.type === MonitorType.HEARTBEAT) {
      await this.heartbeatService.syncMonitorTimeout(monitor);
    }

    return monitor;
  }

  async getMonitor(user: AuthenticatedUser, monitorId: string): Promise<Monitor> {
    return this.getOwnedMonitorOrThrow(user.id, monitorId);
  }

  async updateMonitor(
    user: AuthenticatedUser,
    monitorId: string,
    updateMonitorDto: UpdateMonitorDto,
  ): Promise<Monitor> {
    const monitor = await this.getOwnedMonitorOrThrow(user.id, monitorId);
    const normalizedMonitor = this.normalizeMonitorInput(
      updateMonitorDto,
      user.plan,
      monitor,
    );

    const updatedMonitor = await this.monitorsRepository.update(monitor.id, {
      name: normalizedMonitor.name,
      type: normalizedMonitor.type,
      url: normalizedMonitor.url,
      intervalSeconds: normalizedMonitor.intervalSeconds,
      timeoutMs: normalizedMonitor.timeoutMs,
      isActive: normalizedMonitor.isActive,
      keywordExpected: normalizedMonitor.keywordExpected,
      keywordMustExist: normalizedMonitor.keywordMustExist,
      consecutiveFailuresThreshold: normalizedMonitor.consecutiveFailuresThreshold,
      heartbeatToken: normalizedMonitor.heartbeatToken,
    });

    if (
      monitor.type === MonitorType.HEARTBEAT &&
      updatedMonitor.type !== MonitorType.HEARTBEAT
    ) {
      await this.heartbeatService.removeMonitorTimeout(monitor.id);
      return updatedMonitor;
    }

    if (updatedMonitor.type === MonitorType.HEARTBEAT) {
      await this.heartbeatService.syncMonitorTimeout(updatedMonitor);
    }

    return updatedMonitor;
  }

  async deleteMonitor(
    user: AuthenticatedUser,
    monitorId: string,
  ): Promise<{ message: string }> {
    const monitor = await this.getOwnedMonitorOrThrow(user.id, monitorId);
    await this.monitorsRepository.delete(monitorId);

    if (monitor.type === MonitorType.HEARTBEAT) {
      await this.heartbeatService.removeMonitorTimeout(monitor.id);
    }

    return {
      message: 'Monitor deleted successfully',
    };
  }

  async getMonitorStats(
    user: AuthenticatedUser,
    monitorId: string,
  ): Promise<MonitorStatsResponse> {
    await this.getOwnedMonitorOrThrow(user.id, monitorId);
    const stats = await this.monitorsRepository.aggregateCheckStats(user.id, monitorId);
    const uptimePercentage =
      stats.totalChecks === 0 ? null : Number(((stats.upChecks / stats.totalChecks) * 100).toFixed(2));

    return {
      monitorId,
      currentStatus: !stats.latestCheck
        ? 'UNKNOWN'
        : stats.latestCheck.isUp
          ? 'UP'
          : 'DOWN',
      totalChecks: stats.totalChecks,
      upChecks: stats.upChecks,
      downChecks: stats.downChecks,
      uptimePercentage,
      averageLatencyMs: stats.avgLatencyMs,
      latestCheckAt: stats.latestCheck?.checkedAt.toISOString() ?? null,
      totalIncidents: stats.totalIncidents,
    };
  }

  async getMonitorChecks(
    user: AuthenticatedUser,
    monitorId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<CheckResult>> {
    await this.getOwnedMonitorOrThrow(user.id, monitorId);
    const [items, total] = await Promise.all([
      this.monitorsRepository.findCheckResults({
        userId: user.id,
        monitorId,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.monitorsRepository.countCheckResults(user.id, monitorId),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getMonitorIncidents(
    user: AuthenticatedUser,
    monitorId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResponse<Incident>> {
    await this.getOwnedMonitorOrThrow(user.id, monitorId);
    const [items, total] = await Promise.all([
      this.monitorsRepository.findIncidents({
        userId: user.id,
        monitorId,
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.monitorsRepository.countIncidents(user.id, monitorId),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  private async getOwnedMonitorOrThrow(
    userId: string,
    monitorId: string,
  ): Promise<Monitor> {
    const monitor = await this.monitorsRepository.findOwnedById(userId, monitorId);

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    return monitor;
  }

  private normalizeMonitorInput(
    input: CreateMonitorDto | UpdateMonitorDto,
    plan: AuthenticatedUser['plan'],
    existingMonitor: Monitor | null,
  ): NormalizedMonitorPayload {
    const type = input.type ?? existingMonitor?.type;
    const name = input.name?.trim() ?? existingMonitor?.name;
    const timeoutMs = input.timeoutMs ?? existingMonitor?.timeoutMs ?? 10000;
    const intervalSeconds =
      input.intervalSeconds ?? existingMonitor?.intervalSeconds;
    const isActive = input.isActive ?? existingMonitor?.isActive ?? true;
    const consecutiveFailuresThreshold =
      input.consecutiveFailuresThreshold ??
      existingMonitor?.consecutiveFailuresThreshold ??
      2;

    if (!type) {
      throw new BadRequestException('type is required');
    }

    if (!name) {
      throw new BadRequestException('name is required');
    }

    if (!intervalSeconds) {
      throw new BadRequestException('intervalSeconds is required');
    }

    const planLimits = PLAN_LIMITS[plan];

    if (intervalSeconds < planLimits.minMonitorIntervalSeconds) {
      throw new ConflictException(
        `Plan ${plan} requires monitor intervals of at least ${planLimits.minMonitorIntervalSeconds} seconds`,
      );
    }

    const rawUrl = input.url?.trim() ?? existingMonitor?.url ?? null;
    const rawKeywordExpected =
      input.keywordExpected?.trim() ?? existingMonitor?.keywordExpected ?? null;
    const rawKeywordMustExist =
      input.keywordMustExist ?? existingMonitor?.keywordMustExist ?? null;

    switch (type) {
      case MonitorType.HTTP:
        this.assertHttpLikeUrl(rawUrl, false);
        this.assertKeywordFieldsAbsent(rawKeywordExpected, rawKeywordMustExist);
        return {
          name,
          type,
          url: rawUrl,
          intervalSeconds,
          timeoutMs,
          isActive,
          keywordExpected: null,
          keywordMustExist: null,
          consecutiveFailuresThreshold,
          heartbeatToken: null,
        };
      case MonitorType.SSL:
        this.assertHttpLikeUrl(rawUrl, true);
        this.assertKeywordFieldsAbsent(rawKeywordExpected, rawKeywordMustExist);
        return {
          name,
          type,
          url: rawUrl,
          intervalSeconds,
          timeoutMs,
          isActive,
          keywordExpected: null,
          keywordMustExist: null,
          consecutiveFailuresThreshold,
          heartbeatToken: null,
        };
      case MonitorType.TCP:
        this.assertTcpTarget(rawUrl);
        this.assertKeywordFieldsAbsent(rawKeywordExpected, rawKeywordMustExist);
        return {
          name,
          type,
          url: rawUrl,
          intervalSeconds,
          timeoutMs,
          isActive,
          keywordExpected: null,
          keywordMustExist: null,
          consecutiveFailuresThreshold,
          heartbeatToken: null,
        };
      case MonitorType.KEYWORD:
        this.assertHttpLikeUrl(rawUrl, false);
        if (!rawKeywordExpected) {
          throw new BadRequestException(
            'keywordExpected is required for KEYWORD monitors',
          );
        }
        if (rawKeywordMustExist === null) {
          throw new BadRequestException(
            'keywordMustExist is required for KEYWORD monitors',
          );
        }
        return {
          name,
          type,
          url: rawUrl,
          intervalSeconds,
          timeoutMs,
          isActive,
          keywordExpected: rawKeywordExpected,
          keywordMustExist: rawKeywordMustExist,
          consecutiveFailuresThreshold,
          heartbeatToken: null,
        };
      case MonitorType.HEARTBEAT:
        if (input.url && input.url.trim().length > 0) {
          throw new BadRequestException(
            'url must be omitted for HEARTBEAT monitors',
          );
        }
        this.assertKeywordFieldsAbsent(rawKeywordExpected, rawKeywordMustExist);
        return {
          name,
          type,
          url: null,
          intervalSeconds,
          timeoutMs,
          isActive,
          keywordExpected: null,
          keywordMustExist: null,
          consecutiveFailuresThreshold,
          heartbeatToken: existingMonitor?.heartbeatToken ?? this.generateHeartbeatToken(),
        };
      default:
        throw new BadRequestException('Unsupported monitor type');
    }
  }

  private assertKeywordFieldsAbsent(
    keywordExpected: string | null,
    keywordMustExist: boolean | null,
  ): void {
    if (keywordExpected !== null || keywordMustExist !== null) {
      throw new BadRequestException(
        'keywordExpected and keywordMustExist are only valid for KEYWORD monitors',
      );
    }
  }

  private assertHttpLikeUrl(
    rawUrl: string | null,
    requireHttps: boolean,
  ): asserts rawUrl is string {
    if (!rawUrl) {
      throw new BadRequestException('url is required for this monitor type');
    }

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      throw new BadRequestException('url must be a valid absolute URL');
    }

    const allowedProtocols = requireHttps ? ['https:'] : ['http:', 'https:'];

    if (!allowedProtocols.includes(parsedUrl.protocol)) {
      throw new BadRequestException(
        requireHttps
          ? 'SSL monitors require an https URL'
          : 'url must use http or https',
      );
    }
  }

  private assertTcpTarget(rawUrl: string | null): asserts rawUrl is string {
    if (!rawUrl) {
      throw new BadRequestException('url is required for TCP monitors');
    }

    const normalizedValue = rawUrl.startsWith('tcp://') ? rawUrl : `tcp://${rawUrl}`;

    let parsedUrl: URL;

    try {
      parsedUrl = new URL(normalizedValue);
    } catch {
      throw new BadRequestException(
        'TCP monitors require a valid host:port target or tcp://host:port URL',
      );
    }

    const port = Number(parsedUrl.port);

    if (!parsedUrl.hostname || !Number.isInteger(port) || port < 1 || port > 65535) {
      throw new BadRequestException(
        'TCP monitors require a valid host:port target or tcp://host:port URL',
      );
    }
  }

  private generateHeartbeatToken(): string {
    return randomBytes(24).toString('hex');
  }
}
