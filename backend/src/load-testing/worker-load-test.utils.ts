import { MonitorType, type Prisma } from '@prisma/client';

export const SUPPORTED_LOAD_TEST_MONITOR_TYPES = [
  MonitorType.HTTP,
  MonitorType.TCP,
  MonitorType.KEYWORD,
] as const;

export type SupportedLoadTestMonitorType =
  (typeof SUPPORTED_LOAD_TEST_MONITOR_TYPES)[number];

export interface LoadTestMonitorTargets {
  httpUrl: string;
  tcpTarget: string;
  keywordUrl: string;
  keywordExpected: string;
}

export interface BuildLoadTestMonitorPlanParams extends LoadTestMonitorTargets {
  monitorCount: number;
  types: SupportedLoadTestMonitorType[];
  intervalSeconds: number;
  timeoutMs: number;
  userId: string;
  tag: string;
}

export function parseLoadTestMonitorTypes(
  rawValue: string | undefined,
): SupportedLoadTestMonitorType[] {
  if (!rawValue) {
    return [MonitorType.HTTP];
  }

  const tokens = rawValue
    .split(',')
    .map((value) => value.trim().toUpperCase())
    .filter((value) => value.length > 0);

  if (tokens.length === 0) {
    throw new Error('The --types argument must contain at least one monitor type');
  }

  const parsedTypes = tokens.map((token) => {
    if (
      SUPPORTED_LOAD_TEST_MONITOR_TYPES.includes(
        token as SupportedLoadTestMonitorType,
      )
    ) {
      return token as SupportedLoadTestMonitorType;
    }

    throw new Error(
      `Unsupported monitor type "${token}". Allowed values: ${SUPPORTED_LOAD_TEST_MONITOR_TYPES.join(
        ', ',
      )}`,
    );
  });

  return [...new Set(parsedTypes)];
}

export function buildLoadTestMonitorPlan(
  params: BuildLoadTestMonitorPlanParams,
): Prisma.MonitorCreateManyInput[] {
  if (params.monitorCount <= 0) {
    throw new Error('monitorCount must be greater than zero');
  }

  if (params.types.length === 0) {
    throw new Error('At least one load test monitor type is required');
  }

  return Array.from({ length: params.monitorCount }, (_, index) => {
    const type = params.types[index % params.types.length];
    const monitorNumber = String(index + 1).padStart(4, '0');
    const commonFields = {
      userId: params.userId,
      name: `loadtest-${params.tag}-${monitorNumber}-${type.toLowerCase()}`,
      type,
      intervalSeconds: params.intervalSeconds,
      timeoutMs: params.timeoutMs,
      isActive: true,
      consecutiveFailuresThreshold: 2,
    } satisfies Omit<
      Prisma.MonitorCreateManyInput,
      'url' | 'keywordExpected' | 'keywordMustExist'
    >;

    switch (type) {
      case MonitorType.HTTP:
        return {
          ...commonFields,
          url: params.httpUrl,
          keywordExpected: null,
          keywordMustExist: null,
        };
      case MonitorType.TCP:
        return {
          ...commonFields,
          url: params.tcpTarget,
          keywordExpected: null,
          keywordMustExist: null,
        };
      case MonitorType.KEYWORD:
        return {
          ...commonFields,
          url: params.keywordUrl,
          keywordExpected: params.keywordExpected,
          keywordMustExist: true,
        };
    }
  });
}
