import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Monitor } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import type { PaginatedResponse } from '../monitors/monitors.service';
import { MonitorsRepository } from '../monitors/repositories/monitors.repository';
import { PaginationQueryDto } from '../users/dto/pagination-query.dto';
import { CreateStatusPageDto } from './dto/create-status-page.dto';
import { UpdateStatusPageDto } from './dto/update-status-page.dto';
import {
  StatusPagesRepository,
  type StatusPageWithMonitorStatus,
} from './repositories/status-pages.repository';
import {
  type PublicStatusPageResponse,
  type StatusPageDetailResponse,
  type StatusPageMonitorStatus,
  type StatusPageMonitorSummary,
  type StatusPageOverallStatus,
} from './status-pages.types';

@Injectable()
export class StatusPagesService {
  constructor(
    private readonly statusPagesRepository: StatusPagesRepository,
    private readonly monitorsRepository: MonitorsRepository,
  ) {}

  async listStatusPages(
    user: AuthenticatedUser,
    pagination: PaginationQueryDto,
  ): Promise<PaginatedResponse<StatusPageDetailResponse>> {
    const [items, total] = await Promise.all([
      this.statusPagesRepository.findManyByUserId({
        userId: user.id,
        skip: (pagination.page - 1) * pagination.limit,
        take: pagination.limit,
      }),
      this.statusPagesRepository.countByUserId(user.id),
    ]);

    return {
      items: items.map((item) => this.toStatusPageDetailResponse(item)),
      meta: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pagination.limit),
      },
    };
  }

  async createStatusPage(
    user: AuthenticatedUser,
    dto: CreateStatusPageDto,
  ): Promise<StatusPageDetailResponse> {
    const slug = this.normalizeSlug(dto.slug);
    await this.assertSlugAvailable(slug);
    const monitorIds = dto.monitorIds ?? [];

    await this.assertOwnedMonitors(user.id, monitorIds);

    const created = await this.statusPagesRepository.create({
      slug,
      name: dto.name.trim(),
      description: this.normalizeDescription(dto.description),
      isPublic: dto.isPublic ?? true,
      user: {
        connect: {
          id: user.id,
        },
      },
      pageMonitors: {
        create: monitorIds.map((monitorId) => ({
          monitor: {
            connect: {
              id: monitorId,
            },
          },
        })),
      },
    });

    const statusPage = await this.statusPagesRepository.findOwnedById(user.id, created.id);

    if (!statusPage) {
      throw new NotFoundException('Status page not found');
    }

    return this.toStatusPageDetailResponse(statusPage);
  }

  async getStatusPage(
    user: AuthenticatedUser,
    statusPageId: string,
  ): Promise<StatusPageDetailResponse> {
    const statusPage = await this.getOwnedStatusPageOrThrow(user.id, statusPageId);

    return this.toStatusPageDetailResponse(statusPage);
  }

  async updateStatusPage(
    user: AuthenticatedUser,
    statusPageId: string,
    dto: UpdateStatusPageDto,
  ): Promise<StatusPageDetailResponse> {
    const existing = await this.getOwnedStatusPageOrThrow(user.id, statusPageId);
    const nextSlug = dto.slug ? this.normalizeSlug(dto.slug) : existing.slug;

    if (nextSlug !== existing.slug) {
      await this.assertSlugAvailable(nextSlug, existing.id);
    }

    if (dto.monitorIds) {
      await this.assertOwnedMonitors(user.id, dto.monitorIds);
    }

    await this.statusPagesRepository.update(existing.id, {
      slug: nextSlug,
      name: dto.name?.trim() ?? existing.name,
      description:
        dto.description !== undefined
          ? this.normalizeDescription(dto.description)
          : existing.description,
      isPublic: dto.isPublic ?? existing.isPublic,
      ...(dto.monitorIds
        ? {
            pageMonitors: {
              deleteMany: {},
              create: dto.monitorIds.map((monitorId) => ({
                monitor: {
                  connect: {
                    id: monitorId,
                  },
                },
              })),
            },
          }
        : {}),
    });

    const updated = await this.getOwnedStatusPageOrThrow(user.id, existing.id);

    return this.toStatusPageDetailResponse(updated);
  }

  async deleteStatusPage(
    user: AuthenticatedUser,
    statusPageId: string,
  ): Promise<{ message: string }> {
    await this.getOwnedStatusPageOrThrow(user.id, statusPageId);
    await this.statusPagesRepository.delete(statusPageId);

    return {
      message: 'Status page deleted successfully',
    };
  }

  async getPublicStatusPage(slug: string): Promise<PublicStatusPageResponse> {
    const statusPage = await this.statusPagesRepository.findPublicBySlug(
      this.normalizeSlug(slug),
    );

    if (!statusPage) {
      throw new NotFoundException('Status page not found');
    }

    const detail = this.toStatusPageDetailResponse(statusPage);

    return {
      slug: detail.slug,
      name: detail.name,
      description: detail.description,
      overallStatus: detail.overallStatus,
      monitors: detail.monitors,
      updatedAt: detail.updatedAt,
    };
  }

  private async getOwnedStatusPageOrThrow(
    userId: string,
    statusPageId: string,
  ): Promise<StatusPageWithMonitorStatus> {
    const statusPage = await this.statusPagesRepository.findOwnedById(
      userId,
      statusPageId,
    );

    if (!statusPage) {
      throw new NotFoundException('Status page not found');
    }

    return statusPage;
  }

  private async assertSlugAvailable(
    slug: string,
    currentStatusPageId?: string,
  ): Promise<void> {
    const existing = await this.statusPagesRepository.findBySlug(slug);

    if (existing && existing.id !== currentStatusPageId) {
      throw new ConflictException('Status page slug is already in use');
    }
  }

  private async assertOwnedMonitors(
    userId: string,
    monitorIds: string[],
  ): Promise<void> {
    const monitors = await this.monitorsRepository.findManyOwnedByIds(userId, monitorIds);

    if (monitors.length !== monitorIds.length) {
      throw new NotFoundException(
        'One or more monitors were not found for the authenticated user',
      );
    }
  }

  private normalizeSlug(slug: string): string {
    return slug.trim().toLowerCase();
  }

  private normalizeDescription(description?: string): string | null {
    const normalized = description?.trim() ?? '';

    return normalized.length > 0 ? normalized : null;
  }

  private toStatusPageDetailResponse(
    statusPage: StatusPageWithMonitorStatus,
  ): StatusPageDetailResponse {
    const monitors = statusPage.pageMonitors.map(({ monitor }) =>
      this.toMonitorSummary(monitor),
    );

    return {
      id: statusPage.id,
      slug: statusPage.slug,
      name: statusPage.name,
      description: statusPage.description,
      isPublic: statusPage.isPublic,
      overallStatus: this.calculateOverallStatus(monitors),
      createdAt: statusPage.createdAt.toISOString(),
      updatedAt: statusPage.updatedAt.toISOString(),
      monitors,
    };
  }

  private toMonitorSummary(monitor: StatusPageWithMonitorStatus['pageMonitors'][number]['monitor']): StatusPageMonitorSummary {
    const latestCheck = monitor.checkResults[0] ?? null;
    const openIncident = monitor.incidents[0] ?? null;
    const status: StatusPageMonitorStatus = openIncident
      ? 'DOWN'
      : latestCheck
        ? latestCheck.isUp
          ? 'UP'
          : 'DOWN'
        : 'UNKNOWN';

    return {
      monitorId: monitor.id,
      name: monitor.name,
      type: monitor.type,
      isActive: monitor.isActive,
      status,
      lastCheckedAt: monitor.lastCheckedAt?.toISOString() ?? null,
      cause: openIncident?.cause ?? latestCheck?.error ?? null,
      incidentId: openIncident?.id ?? null,
    };
  }

  private calculateOverallStatus(
    monitors: StatusPageMonitorSummary[],
  ): StatusPageOverallStatus {
    if (monitors.length === 0) {
      return 'UNKNOWN';
    }

    const upCount = monitors.filter((monitor) => monitor.status === 'UP').length;
    const downCount = monitors.filter((monitor) => monitor.status === 'DOWN').length;

    if (downCount === 0 && upCount > 0) {
      return 'OPERATIONAL';
    }

    if (downCount === monitors.length) {
      return 'OUTAGE';
    }

    if (downCount > 0) {
      return 'DEGRADED';
    }

    return 'UNKNOWN';
  }
}
