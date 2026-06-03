export const BULL_QUEUE_NAMES = [
  'monitor-checks-http',
  'monitor-checks-tcp',
  'monitor-checks-ssl',
  'monitor-checks-keyword',
  'heartbeat-timeout',
  'alerts',
] as const;

export type BullQueueName = (typeof BULL_QUEUE_NAMES)[number];
