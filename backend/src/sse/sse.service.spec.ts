import { firstValueFrom } from 'rxjs';
import type { MessageEvent } from '@nestjs/common';
import { skip, take } from 'rxjs/operators';
import { Plan } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { SseRepository } from './repositories/sse.repository';
import { SseService } from './sse.service';

describe('SseService', () => {
  let sseService: SseService;
  let sseRepository: jest.Mocked<SseRepository>;

  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'john@uptimewatch.dev',
    plan: Plan.FREE,
    dodoCustomerId: null,
  };

  beforeEach(() => {
    sseRepository = {
      findMonitorStatusSnapshotByUserId: jest.fn(),
    } as unknown as jest.Mocked<SseRepository>;

    sseService = new SseService(sseRepository);
  });

  it('emits a connected event first and then the initial snapshot', async () => {
    sseRepository.findMonitorStatusSnapshotByUserId.mockResolvedValue([
      {
        monitorId: 'monitor-1',
        monitorName: 'API Principal',
        monitorType: 'HTTP',
        isActive: true,
        status: 'UP',
        incidentId: null,
        cause: null,
        changedAt: '2026-05-24T10:00:00.000Z',
        lastCheckedAt: '2026-05-24T10:00:00.000Z',
      },
    ]);

    const stream = sseService.streamMonitorEvents(user);
    const connected = await firstValueFrom(stream.pipe(take(1)));
    const snapshot = await firstValueFrom(stream.pipe(skip(1), take(1)));

    expect(connected.type).toBe('connected');
    expect(snapshot.type).toBe('snapshot');
    expect(sseRepository.findMonitorStatusSnapshotByUserId).toHaveBeenCalledWith(user.id);
  });

  it('only forwards monitor status changes for the subscribed user', async () => {
    sseRepository.findMonitorStatusSnapshotByUserId.mockResolvedValue([]);

    const stream = sseService.streamMonitorEvents(user);
    const events: MessageEvent[] = [];
    let markSnapshotReady: (() => void) | undefined;
    const snapshotReady = new Promise<void>((resolve) => {
      markSnapshotReady = resolve;
    });
    const nextChange = new Promise<MessageEvent>((resolve) => {
      const subscription = stream.subscribe((event) => {
        events.push(event);

        if (event.type === 'snapshot') {
          markSnapshotReady?.();
        }

        if (event.type === 'monitor-status-changed') {
          subscription.unsubscribe();
          resolve(event);
        }
      });
    });

    await snapshotReady;

    sseService.publishMonitorStatusChange({
      userId: 'other-user',
      monitorId: 'monitor-ignored',
      monitorName: 'Ignored',
      monitorType: 'HTTP',
      status: 'DOWN',
      incidentId: 'incident-ignored',
      cause: 'HTTP 500',
      changedAt: '2026-05-24T10:01:00.000Z',
    });
    sseService.publishMonitorStatusChange({
      userId: user.id,
      monitorId: 'monitor-1',
      monitorName: 'API Principal',
      monitorType: 'HTTP',
      status: 'DOWN',
      incidentId: 'incident-1',
      cause: 'HTTP 500',
      changedAt: '2026-05-24T10:02:00.000Z',
    });

    const event = await nextChange;

    expect(events[0]?.type).toBe('connected');
    expect(events[1]?.type).toBe('snapshot');
    expect(event.type).toBe('monitor-status-changed');
    expect(event.data).toMatchObject({
      userId: user.id,
      monitorId: 'monitor-1',
      status: 'DOWN',
    });
  });
});
