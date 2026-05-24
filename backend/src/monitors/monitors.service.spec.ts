import { BadRequestException, ConflictException } from '@nestjs/common';
import { MonitorType, Plan, type CheckResult, type Monitor } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { HeartbeatService } from '../heartbeat/heartbeat.service';
import { MonitorsService } from './monitors.service';
import { MonitorsRepository } from './repositories/monitors.repository';

describe('MonitorsService', () => {
  let monitorsService: MonitorsService;
  let monitorsRepository: jest.Mocked<MonitorsRepository>;
  let heartbeatService: jest.Mocked<HeartbeatService>;

  const currentUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'john@uptimewatch.dev',
    plan: Plan.FREE,
    dodoCustomerId: null,
  };

  const baseMonitor: Monitor = {
    id: '7f9d9c77-31d4-4b74-b0d2-d60b4bcbe3d0',
    userId: 'user-1',
    name: 'API Principal',
    url: 'https://api.uptimewatch.dev/health',
    type: MonitorType.HTTP,
    intervalSeconds: 300,
    timeoutMs: 10000,
    isActive: true,
    keywordExpected: null,
    keywordMustExist: null,
    consecutiveFailuresThreshold: 2,
    heartbeatToken: null,
    lastCheckedAt: null,
    createdAt: new Date('2026-05-23T00:00:00.000Z'),
    updatedAt: new Date('2026-05-23T00:00:00.000Z'),
  };

  beforeEach(() => {
    monitorsRepository = {
      countByUserId: jest.fn(),
      findManyByUserId: jest.fn(),
      countVisibleByUserId: jest.fn(),
      findOwnedById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countCheckResults: jest.fn(),
      findCheckResults: jest.fn(),
      countIncidents: jest.fn(),
      findIncidents: jest.fn(),
      aggregateCheckStats: jest.fn(),
    } as unknown as jest.Mocked<MonitorsRepository>;

    heartbeatService = {
      ping: jest.fn(),
      syncMonitorTimeout: jest.fn(),
      removeMonitorTimeout: jest.fn(),
      processTimeoutJob: jest.fn(),
    } as unknown as jest.Mocked<HeartbeatService>;

    monitorsService = new MonitorsService(monitorsRepository, heartbeatService);
  });

  it('rejects monitor creation when the FREE plan limit is exceeded', async () => {
    monitorsRepository.countByUserId.mockResolvedValue(5);

    await expect(
      monitorsService.createMonitor(currentUser, {
        name: 'Extra monitor',
        type: MonitorType.HTTP,
        url: 'https://api.uptimewatch.dev/health',
        intervalSeconds: 300,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects KEYWORD monitors without keywordExpected and keywordMustExist', async () => {
    monitorsRepository.countByUserId.mockResolvedValue(0);

    await expect(
      monitorsService.createMonitor(currentUser, {
        name: 'Keyword monitor',
        type: MonitorType.KEYWORD,
        url: 'https://api.uptimewatch.dev/health',
        intervalSeconds: 300,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a HEARTBEAT monitor with generated token and null url', async () => {
    monitorsRepository.countByUserId.mockResolvedValue(0);
    monitorsRepository.create.mockImplementation(async (data) => ({
      ...baseMonitor,
      name: data.name as string,
      type: data.type as MonitorType,
      url: data.url as string | null,
      heartbeatToken: data.heartbeatToken as string,
    }));

    const result = await monitorsService.createMonitor(currentUser, {
      name: 'Heartbeat Worker',
      type: MonitorType.HEARTBEAT,
      intervalSeconds: 300,
    });

    expect(result.type).toBe(MonitorType.HEARTBEAT);
    expect(result.url).toBeNull();
    expect(result.heartbeatToken).toEqual(expect.any(String));
    expect(heartbeatService.syncMonitorTimeout).toHaveBeenCalledWith(result);
  });

  it('computes monitor statistics from aggregate repository data', async () => {
    monitorsRepository.findOwnedById.mockResolvedValue(baseMonitor);
    monitorsRepository.aggregateCheckStats.mockResolvedValue({
      totalChecks: 10,
      upChecks: 8,
      downChecks: 2,
      avgLatencyMs: 245,
      latestCheck: {
        id: 'check-1',
        monitorId: baseMonitor.id,
        checkedAt: new Date('2026-05-23T12:00:00.000Z'),
        statusCode: 200,
        latencyMs: 210,
        isUp: true,
        error: null,
        keywordFound: null,
        createdAt: new Date('2026-05-23T12:00:00.000Z'),
      } as CheckResult,
      totalIncidents: 3,
    });

    const result = await monitorsService.getMonitorStats(currentUser, baseMonitor.id);

    expect(result.uptimePercentage).toBe(80);
    expect(result.currentStatus).toBe('UP');
    expect(result.totalIncidents).toBe(3);
  });
});
