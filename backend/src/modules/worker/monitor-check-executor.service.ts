import { Injectable } from '@nestjs/common';
import net from 'node:net';
import tls from 'node:tls';
import { MonitorType } from '@prisma/client';
import type {
  MonitorCheckExecutionResult,
  MonitorExecutionTarget,
} from './worker.types';
import { WORKER_SSL_EXPIRY_THRESHOLD_DAYS } from './worker.types';
import { WorkerHttpClientService } from './worker-http-client.service';

const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class MonitorCheckExecutorService {
  constructor(
    private readonly workerHttpClientService: WorkerHttpClientService,
  ) {}

  async execute(
    monitor: MonitorExecutionTarget,
  ): Promise<MonitorCheckExecutionResult> {
    switch (monitor.type) {
      case MonitorType.HTTP:
        return this.executeHttpCheck(monitor);
      case MonitorType.TCP:
        return this.executeTcpCheck(monitor);
      case MonitorType.SSL:
        return this.executeSslCheck(monitor);
      case MonitorType.KEYWORD:
        return this.executeKeywordCheck(monitor);
      case MonitorType.HEARTBEAT:
        return {
          checkedAt: new Date(),
          isUp: true,
          statusCode: null,
          latencyMs: null,
          error: null,
          keywordFound: null,
        };
      default:
        return {
          checkedAt: new Date(),
          isUp: false,
          statusCode: null,
          latencyMs: null,
          error: `Unsupported monitor type: ${String(monitor.type)}`,
          keywordFound: null,
        };
    }
  }

  private async executeHttpCheck(
    monitor: MonitorExecutionTarget,
  ): Promise<MonitorCheckExecutionResult> {
    const checkedAt = new Date();
    const startedAt = Date.now();

    try {
      const response = await this.workerHttpClientService.request(
        this.requireUrl(monitor),
        {
        method: 'GET',
        signal: AbortSignal.timeout(monitor.timeoutMs),
        headers: {
          'user-agent': 'UptimeWatch/1.0',
        },
        },
      );
      await response.body.text();

      const latencyMs = Date.now() - startedAt;
      const isUp = response.statusCode < 400;

      return {
        checkedAt,
        isUp,
        statusCode: response.statusCode,
        latencyMs,
        error: isUp ? null : `HTTP status ${response.statusCode}`,
        keywordFound: null,
      };
    } catch (error: unknown) {
      return {
        checkedAt,
        isUp: false,
        statusCode: null,
        latencyMs: Date.now() - startedAt,
        error: this.normalizeErrorMessage(error, monitor.timeoutMs),
        keywordFound: null,
      };
    }
  }

  private async executeKeywordCheck(
    monitor: MonitorExecutionTarget,
  ): Promise<MonitorCheckExecutionResult> {
    const checkedAt = new Date();
    const startedAt = Date.now();

    try {
      const response = await this.workerHttpClientService.request(
        this.requireUrl(monitor),
        {
        method: 'GET',
        signal: AbortSignal.timeout(monitor.timeoutMs),
        headers: {
          'user-agent': 'UptimeWatch/1.0',
        },
        },
      );
      const body = await response.body.text();
      const latencyMs = Date.now() - startedAt;
      const keywordFound = body.includes(monitor.keywordExpected ?? '');
      const expectPresence = monitor.keywordMustExist ?? true;
      const keywordSatisfied = expectPresence ? keywordFound : !keywordFound;
      const isUp = response.statusCode < 400 && keywordSatisfied;
      let error: string | null = null;

      if (response.statusCode >= 400) {
        error = `HTTP status ${response.statusCode}`;
      } else if (!keywordSatisfied) {
        error = expectPresence
          ? `Expected keyword "${monitor.keywordExpected ?? ''}" was not found`
          : `Unexpected keyword "${monitor.keywordExpected ?? ''}" was found`;
      }

      return {
        checkedAt,
        isUp,
        statusCode: response.statusCode,
        latencyMs,
        error,
        keywordFound,
      };
    } catch (error: unknown) {
      return {
        checkedAt,
        isUp: false,
        statusCode: null,
        latencyMs: Date.now() - startedAt,
        error: this.normalizeErrorMessage(error, monitor.timeoutMs),
        keywordFound: null,
      };
    }
  }

  private async executeTcpCheck(
    monitor: MonitorExecutionTarget,
  ): Promise<MonitorCheckExecutionResult> {
    const checkedAt = new Date();
    const startedAt = Date.now();
    const target = this.parseTcpTarget(this.requireUrl(monitor));

    return new Promise<MonitorCheckExecutionResult>((resolve) => {
      const socket = new net.Socket();
      let settled = false;

      const finish = (result: MonitorCheckExecutionResult) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.setTimeout(monitor.timeoutMs);
      socket.once('connect', () => {
        finish({
          checkedAt,
          isUp: true,
          statusCode: null,
          latencyMs: Date.now() - startedAt,
          error: null,
          keywordFound: null,
        });
      });
      socket.once('timeout', () => {
        finish({
          checkedAt,
          isUp: false,
          statusCode: null,
          latencyMs: Date.now() - startedAt,
          error: `TCP connection timed out after ${monitor.timeoutMs}ms`,
          keywordFound: null,
        });
      });
      socket.once('error', (error: Error) => {
        finish({
          checkedAt,
          isUp: false,
          statusCode: null,
          latencyMs: Date.now() - startedAt,
          error: error.message,
          keywordFound: null,
        });
      });

      socket.connect(target.port, target.hostname);
    });
  }

  private async executeSslCheck(
    monitor: MonitorExecutionTarget,
  ): Promise<MonitorCheckExecutionResult> {
    const checkedAt = new Date();
    const startedAt = Date.now();
    const targetUrl = new URL(this.requireUrl(monitor));
    const port = targetUrl.port ? Number(targetUrl.port) : 443;

    return new Promise<MonitorCheckExecutionResult>((resolve) => {
      let settled = false;
      const socket = tls.connect({
        host: targetUrl.hostname,
        port,
        servername: targetUrl.hostname,
        rejectUnauthorized: false,
        timeout: monitor.timeoutMs,
      });

      const finish = (result: MonitorCheckExecutionResult) => {
        if (settled) {
          return;
        }

        settled = true;
        socket.destroy();
        resolve(result);
      };

      socket.once('secureConnect', () => {
        const certificate = socket.getPeerCertificate();

        if (!certificate || !certificate.valid_to) {
          finish({
            checkedAt,
            isUp: false,
            statusCode: null,
            latencyMs: Date.now() - startedAt,
            error: 'SSL certificate could not be read',
            keywordFound: null,
          });
          return;
        }

        const expiresAt = new Date(certificate.valid_to);

        if (Number.isNaN(expiresAt.getTime())) {
          finish({
            checkedAt,
            isUp: false,
            statusCode: null,
            latencyMs: Date.now() - startedAt,
            error: 'SSL certificate expiration date is invalid',
            keywordFound: null,
          });
          return;
        }

        const remainingMs = expiresAt.getTime() - checkedAt.getTime();
        const remainingDays = Math.ceil(remainingMs / MILLISECONDS_IN_DAY);
        const isUp = remainingMs >= WORKER_SSL_EXPIRY_THRESHOLD_DAYS * MILLISECONDS_IN_DAY;

        finish({
          checkedAt,
          isUp,
          statusCode: null,
          latencyMs: Date.now() - startedAt,
          error: isUp
            ? null
            : remainingMs < 0
              ? `SSL certificate expired on ${expiresAt.toISOString()}`
              : `SSL certificate expires in ${remainingDays} day(s)`,
          keywordFound: null,
        });
      });
      socket.once('timeout', () => {
        finish({
          checkedAt,
          isUp: false,
          statusCode: null,
          latencyMs: Date.now() - startedAt,
          error: `SSL connection timed out after ${monitor.timeoutMs}ms`,
          keywordFound: null,
        });
      });
      socket.once('error', (error: Error) => {
        finish({
          checkedAt,
          isUp: false,
          statusCode: null,
          latencyMs: Date.now() - startedAt,
          error: error.message,
          keywordFound: null,
        });
      });
    });
  }

  private requireUrl(monitor: MonitorExecutionTarget): string {
    if (!monitor.url) {
      throw new Error(`Monitor ${monitor.id} does not have a target URL`);
    }

    return monitor.url;
  }

  private parseTcpTarget(rawTarget: string): {
    hostname: string;
    port: number;
  } {
    const normalizedTarget = rawTarget.startsWith('tcp://')
      ? rawTarget
      : `tcp://${rawTarget}`;
    const parsedTarget = new URL(normalizedTarget);
    const port = Number(parsedTarget.port);

    if (!parsedTarget.hostname || !Number.isInteger(port)) {
      throw new Error('TCP monitor target must be a valid host:port pair');
    }

    return {
      hostname: parsedTarget.hostname,
      port,
    };
  }

  private normalizeErrorMessage(error: unknown, timeoutMs: number): string {
    if (error instanceof Error) {
      if (error.name === 'TimeoutError' || error.name === 'AbortError') {
        return `Request timed out after ${timeoutMs}ms`;
      }

      return error.message;
    }

    return 'Unknown monitor check error';
  }
}
