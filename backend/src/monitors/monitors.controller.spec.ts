import { MonitorType, Plan } from '@prisma/client';
import { MonitorsController } from './monitors.controller';
import { MonitorsService } from './monitors.service';

describe('MonitorsController', () => {
  let monitorsController: MonitorsController;
  let monitorsService: jest.Mocked<MonitorsService>;

  beforeEach(() => {
    monitorsService = {
      listMonitors: jest.fn().mockResolvedValue({
        items: [],
        meta: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      }),
      createMonitor: jest.fn().mockResolvedValue({
        id: 'monitor-1',
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
      }),
      getMonitorStats: jest.fn().mockResolvedValue({
        monitorId: 'monitor-1',
        currentStatus: 'UNKNOWN',
        totalChecks: 0,
        upChecks: 0,
        downChecks: 0,
        uptimePercentage: null,
        averageLatencyMs: null,
        latestCheckAt: null,
        totalIncidents: 0,
      }),
      getMonitorChecks: jest.fn(),
      getMonitorIncidents: jest.fn(),
      getMonitor: jest.fn(),
      updateMonitor: jest.fn(),
      deleteMonitor: jest.fn(),
    } as unknown as jest.Mocked<MonitorsService>;

    monitorsController = new MonitorsController(monitorsService);
  });

  it('lists monitors with pagination', async () => {
    const result = await monitorsController.findAll(
      {
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      },
      {
        page: 1,
        limit: 10,
      },
    );

    expect(result.meta.page).toBe(1);
    expect(monitorsService.listMonitors).toHaveBeenCalled();
  });

  it('creates a monitor', async () => {
    const result = await monitorsController.create(
      {
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      },
      {
        name: 'API Principal',
        type: MonitorType.HTTP,
        url: 'https://api.uptimewatch.dev/health',
        intervalSeconds: 300,
      },
    );

    expect(result.name).toBe('API Principal');
  });

  it('returns monitor stats', async () => {
    const result = await monitorsController.getStats(
      {
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      },
      '7f9d9c77-31d4-4b74-b0d2-d60b4bcbe3d0',
    );

    expect(result.monitorId).toBe('monitor-1');
  });
});
