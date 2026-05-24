import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { BULL_QUEUE_NAMES, type BullQueueName } from './queue.constants';
import { RedisService } from './redis.service';

@Injectable()
export class BullQueueService implements OnModuleDestroy {
  private readonly queues: Map<BullQueueName, Queue> = new Map();
  private readonly queueEvents: Map<BullQueueName, QueueEvents> = new Map();

  constructor(private readonly redisService: RedisService) {}

  getQueue(name: BullQueueName): Queue {
    this.ensureRegistered(name);
    const queue = this.queues.get(name);

    if (!queue) {
      throw new Error(`Queue "${name}" is not available`);
    }

    return queue;
  }

  getQueueEvents(name: BullQueueName): QueueEvents {
    this.ensureRegistered(name);
    const events = this.queueEvents.get(name);

    if (!events) {
      throw new Error(`Queue events for "${name}" are not available`);
    }

    return events;
  }

  private ensureRegistered(name: BullQueueName): void {
    if (!BULL_QUEUE_NAMES.includes(name)) {
      throw new Error(`Queue "${name}" is not registered`);
    }

    if (!this.queues.has(name)) {
      this.queues.set(
        name,
        new Queue(name, {
          connection: this.redisService.getBullConnection(),
        }),
      );
    }

    if (!this.queueEvents.has(name)) {
      this.queueEvents.set(
        name,
        new QueueEvents(name, {
          connection: this.redisService.getBullConnection(),
        }),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      [...this.queueEvents.values()].map(async (events) => events.close()),
    );
    await Promise.all([...this.queues.values()].map(async (queue) => queue.close()));
  }
}
