import { Injectable, MessageEvent } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import {
  Observable,
  Subject,
  concat,
  defer,
  filter,
  interval,
  map,
  merge,
  of,
} from 'rxjs';
import { SseRepository } from './repositories/sse.repository';
import {
  type MonitorStatusChangeEvent,
  type MonitorStatusSnapshotItem,
} from './sse.types';

@Injectable()
export class SseService {
  private readonly monitorStatusSubject = new Subject<MonitorStatusChangeEvent>();

  constructor(private readonly sseRepository: SseRepository) {}

  streamMonitorEvents(user: AuthenticatedUser): Observable<MessageEvent> {
    const snapshot$ = defer(async () =>
      this.sseRepository.findMonitorStatusSnapshotByUserId(user.id),
    ).pipe(
      map((snapshot) => this.createSnapshotEvent(snapshot)),
    );
    const connected$ = of<MessageEvent>({
      type: 'connected',
      data: {
        connectedAt: new Date().toISOString(),
      },
    });
    const changes$ = this.monitorStatusSubject.pipe(
      filter((event) => event.userId === user.id),
      map((event) => ({
        type: 'monitor-status-changed',
        data: event,
      })),
    );
    const keepAlive$ = interval(30000).pipe(
      map(() => ({
        type: 'keepalive',
        data: {
          timestamp: new Date().toISOString(),
        },
      })),
    );

    return concat(connected$, snapshot$, merge(changes$, keepAlive$));
  }

  publishMonitorStatusChange(event: MonitorStatusChangeEvent): void {
    this.monitorStatusSubject.next(event);
  }

  private createSnapshotEvent(snapshot: MonitorStatusSnapshotItem[]): MessageEvent {
    return {
      type: 'snapshot',
      data: {
        monitors: snapshot,
      },
    };
  }
}
