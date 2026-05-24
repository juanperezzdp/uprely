import { of } from 'rxjs';
import { Plan } from '@prisma/client';
import { SseController } from './sse.controller';
import { SseService } from './sse.service';

describe('SseController', () => {
  let sseController: SseController;
  let sseService: jest.Mocked<SseService>;

  beforeEach(() => {
    sseService = {
      streamMonitorEvents: jest.fn(),
      publishMonitorStatusChange: jest.fn(),
    } as unknown as jest.Mocked<SseService>;

    sseController = new SseController(sseService);
  });

  it('delegates monitor streams to the service', () => {
    const user = {
      id: 'user-1',
      email: 'john@uptimewatch.dev',
      plan: Plan.FREE,
      dodoCustomerId: null,
    };
    const stream = of({
      type: 'connected',
      data: {
        connectedAt: '2026-05-24T10:00:00.000Z',
      },
    });
    sseService.streamMonitorEvents.mockReturnValue(stream);

    const result = sseController.streamMonitors(user);

    expect(sseService.streamMonitorEvents).toHaveBeenCalledWith(user);
    expect(result).toBe(stream);
  });
});
