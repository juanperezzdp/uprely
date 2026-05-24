import { Plan } from '@prisma/client';
import { IncidentStatusFilter } from './dto/list-incidents-query.dto';
import { IncidentsController } from './incidents.controller';
import { IncidentsService } from './incidents.service';

describe('IncidentsController', () => {
  let incidentsController: IncidentsController;
  let incidentsService: jest.Mocked<IncidentsService>;

  beforeEach(() => {
    incidentsService = {
      listIncidents: jest.fn().mockResolvedValue({
        items: [
          {
            id: '59cc4808-3ddd-41f8-a90d-8861ddb661ff',
            monitorId: '7f9d9c77-31d4-4b74-b0d2-d60b4bcbe3d0',
            startedAt: '2026-05-23T12:00:00.000Z',
            confirmedAt: '2026-05-23T12:01:00.000Z',
            resolvedAt: null,
            cause: 'HTTP 500',
            createdAt: '2026-05-23T12:00:00.000Z',
            status: IncidentStatusFilter.OPEN,
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      }),
      getIncidentById: jest.fn().mockResolvedValue({
        id: '59cc4808-3ddd-41f8-a90d-8861ddb661ff',
        monitorId: '7f9d9c77-31d4-4b74-b0d2-d60b4bcbe3d0',
        startedAt: '2026-05-23T12:00:00.000Z',
        confirmedAt: '2026-05-23T12:01:00.000Z',
        resolvedAt: null,
        cause: 'HTTP 500',
        createdAt: '2026-05-23T12:00:00.000Z',
        status: IncidentStatusFilter.OPEN,
      }),
    } as unknown as jest.Mocked<IncidentsService>;

    incidentsController = new IncidentsController(incidentsService);
  });

  it('lists incidents with filters', async () => {
    const result = await incidentsController.findAll(
      {
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      },
      {
        page: 1,
        limit: 10,
        status: IncidentStatusFilter.OPEN,
      },
    );

    expect(result.meta.total).toBe(1);
    expect(incidentsService.listIncidents).toHaveBeenCalled();
  });

  it('returns one incident by id', async () => {
    const result = await incidentsController.findOne(
      {
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      },
      '59cc4808-3ddd-41f8-a90d-8861ddb661ff',
    );

    expect(result.id).toBe('59cc4808-3ddd-41f8-a90d-8861ddb661ff');
  });
});
