export const BULL_QUEUE_NAMES = [
  'monitor-checks',
  'heartbeat-timeout',
  'alerts',
] as const;

export type BullQueueName = (typeof BULL_QUEUE_NAMES)[number];
