import { MonitorType } from '@prisma/client';
import {
  buildLoadTestMonitorPlan,
  parseLoadTestMonitorTypes,
} from './worker-load-test.utils';

describe('worker-load-test.utils', () => {
  it('parses monitor types without duplicates and normalizes case', () => {
    expect(parseLoadTestMonitorTypes('http,tcp,keyword,http')).toEqual([
      MonitorType.HTTP,
      MonitorType.TCP,
      MonitorType.KEYWORD,
    ]);
  });

  it('builds a round-robin monitor plan across the selected types', () => {
    const result = buildLoadTestMonitorPlan({
      monitorCount: 4,
      types: [MonitorType.HTTP, MonitorType.TCP, MonitorType.KEYWORD],
      intervalSeconds: 60,
      timeoutMs: 5000,
      userId: 'user-1',
      tag: 'batch-a',
      httpUrl: 'http://127.0.0.1:4010/health',
      tcpTarget: '127.0.0.1:4011',
      keywordUrl: 'http://127.0.0.1:4010/keyword',
      keywordExpected: 'UPTIMEWATCH_OK',
    });

    expect(result).toHaveLength(4);
    expect(result[0]).toMatchObject({
      type: MonitorType.HTTP,
      url: 'http://127.0.0.1:4010/health',
    });
    expect(result[1]).toMatchObject({
      type: MonitorType.TCP,
      url: '127.0.0.1:4011',
    });
    expect(result[2]).toMatchObject({
      type: MonitorType.KEYWORD,
      url: 'http://127.0.0.1:4010/keyword',
      keywordExpected: 'UPTIMEWATCH_OK',
      keywordMustExist: true,
    });
    expect(result[3]).toMatchObject({
      type: MonitorType.HTTP,
      url: 'http://127.0.0.1:4010/health',
    });
  });
});
