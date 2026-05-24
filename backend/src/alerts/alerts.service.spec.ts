import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AlertContactType, MonitorType, Plan, type AlertContact } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MonitorsRepository } from '../monitors/repositories/monitors.repository';
import { BullQueueService } from '../queue/bull-queue.service';
import { AlertsService } from './alerts.service';
import { AlertEventType } from './alerts.types';
import { AlertsRepository } from './repositories/alerts.repository';

describe('AlertsService', () => {
  let alertsService: AlertsService;
  let alertsRepository: jest.Mocked<AlertsRepository>;
  let monitorsRepository: jest.Mocked<MonitorsRepository>;
  let bullQueueService: jest.Mocked<BullQueueService>;
  let queueAdd: jest.Mock;

  const currentUser: AuthenticatedUser = {
    id: 'user-1',
    email: 'john@uptimewatch.dev',
    plan: Plan.FREE,
    dodoCustomerId: null,
  };

  const baseAlertContact: AlertContact = {
    id: '08ae1f47-b8eb-4863-b9ec-a79d359ef45d',
    userId: 'user-1',
    type: AlertContactType.EMAIL,
    value: 'alerts@uptimewatch.dev',
    createdAt: new Date('2026-05-23T00:00:00.000Z'),
  };

  beforeEach(() => {
    alertsRepository = {
      countByUserId: jest.fn(),
      findManyByUserId: jest.fn(),
      findAllByUserId: jest.fn(),
      findOwnedById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<AlertsRepository>;

    monitorsRepository = {
      findByIdWithOwner: jest.fn(),
    } as unknown as jest.Mocked<MonitorsRepository>;

    queueAdd = jest.fn().mockResolvedValue(undefined);
    bullQueueService = {
      getQueue: jest.fn().mockReturnValue({
        add: queueAdd,
      }),
    } as unknown as jest.Mocked<BullQueueService>;

    alertsService = new AlertsService(
      alertsRepository,
      monitorsRepository,
      bullQueueService,
    );
  });

  it('creates an alert contact when the plan limit allows it', async () => {
    alertsRepository.countByUserId.mockResolvedValue(0);
    alertsRepository.create.mockResolvedValue(baseAlertContact);

    const result = await alertsService.createAlertContact(currentUser, {
      type: AlertContactType.EMAIL,
      value: 'alerts@uptimewatch.dev',
    });

    expect(result.id).toBe(baseAlertContact.id);
    expect(alertsRepository.create).toHaveBeenCalled();
  });

  it('rejects alert contact creation when FREE plan limit is exceeded', async () => {
    alertsRepository.countByUserId.mockResolvedValue(1);

    await expect(
      alertsService.createAlertContact(currentUser, {
        type: AlertContactType.EMAIL,
        value: 'alerts@uptimewatch.dev',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('validates webhook URLs before saving alert contacts', async () => {
    alertsRepository.countByUserId.mockResolvedValue(0);

    await expect(
      alertsService.createAlertContact(currentUser, {
        type: AlertContactType.WEBHOOK,
        value: 'notaurl',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('returns an alert contact owned by the current user', async () => {
    alertsRepository.findOwnedById.mockResolvedValue(baseAlertContact);

    const result = await alertsService.getAlertContact(currentUser, baseAlertContact.id);

    expect(result.id).toBe(baseAlertContact.id);
  });

  it('throws when an alert contact is not found', async () => {
    alertsRepository.findOwnedById.mockResolvedValue(null);

    await expect(
      alertsService.getAlertContact(currentUser, baseAlertContact.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('enqueues a monitor down alert job for all user contacts', async () => {
    monitorsRepository.findByIdWithOwner.mockResolvedValue({
      id: 'monitor-1',
      userId: 'user-1',
      name: 'API Principal',
      url: 'https://api.uptimewatch.dev/health',
      type: MonitorType.HTTP,
      user: {
        id: 'user-1',
        plan: Plan.FREE,
      },
    });
    alertsRepository.findAllByUserId.mockResolvedValue([baseAlertContact]);

    const contactCount = await alertsService.enqueueMonitorDownAlert({
      incidentId: 'incident-1',
      monitorId: 'monitor-1',
      cause: 'HTTP 500',
      startedAt: new Date('2026-05-23T12:00:00.000Z'),
    });

    expect(contactCount).toBe(1);
    expect(queueAdd).toHaveBeenCalledWith(
      AlertEventType.MONITOR_DOWN,
      expect.objectContaining({
        monitorId: 'monitor-1',
        contacts: [
          expect.objectContaining({
            id: baseAlertContact.id,
          }),
        ],
      }),
      expect.any(Object),
    );
  });

  it('does not enqueue alert jobs when the user has no contacts', async () => {
    monitorsRepository.findByIdWithOwner.mockResolvedValue({
      id: 'monitor-1',
      userId: 'user-1',
      name: 'API Principal',
      url: 'https://api.uptimewatch.dev/health',
      type: MonitorType.HTTP,
      user: {
        id: 'user-1',
        plan: Plan.FREE,
      },
    });
    alertsRepository.findAllByUserId.mockResolvedValue([]);

    const contactCount = await alertsService.enqueueMonitorDownAlert({
      incidentId: 'incident-1',
      monitorId: 'monitor-1',
      cause: 'HTTP 500',
      startedAt: new Date('2026-05-23T12:00:00.000Z'),
    });

    expect(contactCount).toBe(0);
    expect(queueAdd).not.toHaveBeenCalled();
  });
});
