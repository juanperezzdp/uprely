import { HeartbeatController } from './heartbeat.controller';
import { HeartbeatService } from './heartbeat.service';

describe('HeartbeatController', () => {
  let heartbeatController: HeartbeatController;
  let heartbeatService: jest.Mocked<HeartbeatService>;

  beforeEach(() => {
    heartbeatService = {
      ping: jest.fn(),
      syncMonitorTimeout: jest.fn(),
      removeMonitorTimeout: jest.fn(),
      processTimeoutJob: jest.fn(),
    } as unknown as jest.Mocked<HeartbeatService>;

    heartbeatController = new HeartbeatController(heartbeatService);
  });

  it('delegates public heartbeat pings to the service', async () => {
    heartbeatService.ping.mockResolvedValue({
      message: 'Heartbeat received',
      monitorId: 'monitor-1',
      receivedAt: '2026-05-23T12:00:00.000Z',
      nextTimeoutAt: '2026-05-23T12:05:10.000Z',
    });

    const result = await heartbeatController.ping('heartbeat-token');

    expect(heartbeatService.ping).toHaveBeenCalledWith('heartbeat-token');
    expect(result.monitorId).toBe('monitor-1');
  });
});
