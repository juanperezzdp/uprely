import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AlertContactType, type AlertContact } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PaginatedResponse } from '../monitors/monitors.service';
import { MonitorsRepository } from '../monitors/repositories/monitors.repository';
import { BullQueueService } from '../queue/bull-queue.service';
import { PLAN_LIMITS } from '../users/constants/plan-limits';
import { PaginationQueryDto } from '../users/dto/pagination-query.dto';
import { AlertEventType, type AlertJobPayload } from './alerts.types';
import { CreateAlertContactDto } from './dto/create-alert-contact.dto';
import { UpdateAlertContactDto } from './dto/update-alert-contact.dto';
import { AlertsRepository } from './repositories/alerts.repository';

@Injectable()
export class AlertsService {
  constructor(
    private readonly alertsRepository: AlertsRepository,
    private readonly monitorsRepository: MonitorsRepository,
    private readonly bullQueueService: BullQueueService,
  ) {}

  async listAlertContacts(
    user: AuthenticatedUser,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<AlertContact>> {
    const [items, total] = await Promise.all([
      this.alertsRepository.findManyByUserId({
        userId: user.id,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.alertsRepository.countByUserId(user.id),
    ]);

    return {
      items,
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pagination.limit),
      },
    };
  }

  async createAlertContact(
    user: AuthenticatedUser,
    dto: CreateAlertContactDto,
  ): Promise<AlertContact> {
    const currentCount = await this.alertsRepository.countByUserId(user.id);
    const maxAlertContacts = PLAN_LIMITS[user.plan].maxAlertContacts;

    if (currentCount >= maxAlertContacts) {
      throw new ConflictException(
        `Plan ${user.plan} only allows up to ${maxAlertContacts} alert contacts`,
      );
    }

    const normalized = this.normalizeContactInput(dto.type, dto.value);

    return this.alertsRepository.create({
      type: normalized.type,
      value: normalized.value,
      user: {
        connect: {
          id: user.id,
        },
      },
    });
  }

  async getAlertContact(
    user: AuthenticatedUser,
    alertContactId: string,
  ): Promise<AlertContact> {
    const alertContact = await this.alertsRepository.findOwnedById(user.id, alertContactId);

    if (!alertContact) {
      throw new NotFoundException('Alert contact not found');
    }

    return alertContact;
  }

  async updateAlertContact(
    user: AuthenticatedUser,
    alertContactId: string,
    dto: UpdateAlertContactDto,
  ): Promise<AlertContact> {
    const alertContact = await this.getAlertContact(user, alertContactId);
    const normalized = this.normalizeContactInput(
      dto.type ?? alertContact.type,
      dto.value ?? alertContact.value,
    );

    return this.alertsRepository.update(alertContact.id, {
      type: normalized.type,
      value: normalized.value,
    });
  }

  async deleteAlertContact(
    user: AuthenticatedUser,
    alertContactId: string,
  ): Promise<{ message: string }> {
    await this.getAlertContact(user, alertContactId);
    await this.alertsRepository.delete(alertContactId);

    return {
      message: 'Alert contact deleted successfully',
    };
  }

  async enqueueMonitorDownAlert(params: {
    incidentId: string;
    monitorId: string;
    cause: string;
    startedAt: Date;
  }): Promise<number> {
    return this.enqueueAlertJobs({
      eventType: AlertEventType.MONITOR_DOWN,
      incidentId: params.incidentId,
      monitorId: params.monitorId,
      cause: params.cause,
      startedAt: params.startedAt,
      resolvedAt: null,
    });
  }

  async enqueueMonitorRecoveredAlert(params: {
    incidentId: string;
    monitorId: string;
    cause: string;
    startedAt: Date;
    resolvedAt: Date;
  }): Promise<number> {
    return this.enqueueAlertJobs({
      eventType: AlertEventType.MONITOR_RECOVERED,
      incidentId: params.incidentId,
      monitorId: params.monitorId,
      cause: params.cause,
      startedAt: params.startedAt,
      resolvedAt: params.resolvedAt,
    });
  }

  private async enqueueAlertJobs(params: {
    eventType: AlertEventType;
    incidentId: string;
    monitorId: string;
    cause: string;
    startedAt: Date;
    resolvedAt: Date | null;
  }): Promise<number> {
    const monitor = await this.monitorsRepository.findByIdWithOwner(params.monitorId);

    if (!monitor) {
      throw new NotFoundException('Monitor not found');
    }

    const contacts = await this.alertsRepository.findAllByUserId(monitor.userId);

    if (contacts.length === 0) {
      return 0;
    }

    const payload: AlertJobPayload = {
      eventType: params.eventType,
      userId: monitor.user.id,
      incidentId: params.incidentId,
      monitorId: monitor.id,
      monitorName: monitor.name,
      monitorType: monitor.type,
      monitorUrl: monitor.url,
      cause: params.cause,
      startedAt: params.startedAt.toISOString(),
      resolvedAt: params.resolvedAt?.toISOString() ?? null,
      contacts: contacts.map((contact) => ({
        id: contact.id,
        type: contact.type,
        value: contact.value,
      })),
    };

    const queue = this.bullQueueService.getQueue('alerts');
    await queue.add(params.eventType, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    });

    return contacts.length;
  }

  private normalizeContactInput(
    type: AlertContactType,
    value: string,
  ): {
    type: AlertContactType;
    value: string;
  } {
    const normalizedValue = value.trim();

    if (!normalizedValue) {
      throw new BadRequestException('value is required');
    }

    switch (type) {
      case AlertContactType.EMAIL:
        this.assertEmail(normalizedValue);
        break;
      case AlertContactType.SMS:
        this.assertSms(normalizedValue);
        break;
      case AlertContactType.WEBHOOK:
        this.assertWebhook(normalizedValue);
        break;
      default:
        throw new BadRequestException('Unsupported alert contact type');
    }

    return {
      type,
      value: normalizedValue,
    };
  }

  private assertEmail(value: string): void {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(value)) {
      throw new BadRequestException('value must be a valid email address');
    }
  }

  private assertSms(value: string): void {
    const phoneRegex = /^\+[1-9]\d{7,14}$/;

    if (!phoneRegex.test(value)) {
      throw new BadRequestException('value must be a valid E.164 phone number');
    }
  }

  private assertWebhook(value: string): void {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(value);
    } catch {
      throw new BadRequestException('value must be a valid absolute URL');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException('webhook URLs must use http or https');
    }
  }
}
