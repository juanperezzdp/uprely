import { Injectable } from '@nestjs/common';
import {
  AlertEventType,
  type AlertContactJobTarget,
  type AlertJobPayload,
} from '../../alerts/alerts.types';
import { WorkerHttpClientService } from './worker-http-client.service';

@Injectable()
export class AlertsProcessorService {
  constructor(
    private readonly workerHttpClientService: WorkerHttpClientService,
  ) {}

  async dispatch(payload: AlertJobPayload): Promise<{
    contactCount: number;
    eventType: AlertEventType;
    monitorId: string;
    incidentId: string;
  }> {
    for (const contact of payload.contacts) {
      await this.dispatchContact(payload.eventType, contact, payload);
    }

    return {
      contactCount: payload.contacts.length,
      eventType: payload.eventType,
      monitorId: payload.monitorId,
      incidentId: payload.incidentId,
    };
  }

  private async dispatchContact(
    eventType: AlertEventType,
    contact: AlertContactJobTarget,
    payload: AlertJobPayload,
  ): Promise<void> {
    switch (contact.type) {
      case 'WEBHOOK': {
        const response = await this.workerHttpClientService.request(contact.value, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
          },
          body: JSON.stringify(payload),
        });

        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw new Error(
            `Webhook dispatch failed with status ${response.statusCode} for contact ${contact.id}`,
          );
        }

        return;
      }
      case 'EMAIL':
      case 'SMS':
        return;
      default:
        throw new Error(
          `Unsupported alert contact type for contact ${contact.id} on ${eventType}`,
        );
    }
  }
}
