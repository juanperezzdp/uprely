import { AlertContactType, Plan } from '@prisma/client';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

describe('AlertsController', () => {
  let alertsController: AlertsController;
  let alertsService: jest.Mocked<AlertsService>;

  beforeEach(() => {
    alertsService = {
      listAlertContacts: jest.fn().mockResolvedValue({
        items: [],
        meta: {
          page: 1,
          limit: 10,
          total: 0,
          totalPages: 0,
        },
      }),
      createAlertContact: jest.fn().mockResolvedValue({
        id: '08ae1f47-b8eb-4863-b9ec-a79d359ef45d',
        userId: 'user-1',
        type: AlertContactType.EMAIL,
        value: 'alerts@uptimewatch.dev',
        createdAt: new Date('2026-05-23T00:00:00.000Z'),
      }),
      getAlertContact: jest.fn().mockResolvedValue({
        id: '08ae1f47-b8eb-4863-b9ec-a79d359ef45d',
        userId: 'user-1',
        type: AlertContactType.EMAIL,
        value: 'alerts@uptimewatch.dev',
        createdAt: new Date('2026-05-23T00:00:00.000Z'),
      }),
      updateAlertContact: jest.fn(),
      deleteAlertContact: jest.fn(),
      enqueueMonitorDownAlert: jest.fn(),
      enqueueMonitorRecoveredAlert: jest.fn(),
    } as unknown as jest.Mocked<AlertsService>;

    alertsController = new AlertsController(alertsService);
  });

  it('lists alert contacts with pagination', async () => {
    const result = await alertsController.findAll(
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
    expect(alertsService.listAlertContacts).toHaveBeenCalled();
  });

  it('creates an alert contact', async () => {
    const result = await alertsController.create(
      {
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      },
      {
        type: AlertContactType.EMAIL,
        value: 'alerts@uptimewatch.dev',
      },
    );

    expect(result.type).toBe(AlertContactType.EMAIL);
  });

  it('returns one alert contact by id', async () => {
    const result = await alertsController.findOne(
      {
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      },
      '08ae1f47-b8eb-4863-b9ec-a79d359ef45d',
    );

    expect(result.id).toBe('08ae1f47-b8eb-4863-b9ec-a79d359ef45d');
  });
});
