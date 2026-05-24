import { ConflictException, NotFoundException } from '@nestjs/common';
import { MonitorType, Plan, type StatusPage } from '@prisma/client';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { MonitorsRepository } from '../monitors/repositories/monitors.repository';
import { StatusPagesRepository } from './repositories/status-pages.repository';
import { StatusPagesService } from './status-pages.service';

describe('StatusPagesService', () => {
  let statusPagesService: StatusPagesService;
  let statusPagesRepository: jest.Mocked<StatusPagesRepository>;
  let monitorsRepository: jest.Mocked<MonitorsRepository>;

  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'john@uptimewatch.dev',
    plan: Plan.FREE,
    dodoCustomerId: null,
  };

  const baseStatusPage = {
    id: 'status-page-1',
    userId: user.id,
    slug: 'api-production',
    name: 'API Production',
    description: 'Public production status page',
    isPublic: true,
    createdAt: new Date('2026-05-24T12:00:00.000Z'),
    updatedAt: new Date('2026-05-24T12:00:00.000Z'),
    pageMonitors: [
      {
        statusPageId: 'status-page-1',
        monitorId: 'monitor-1',
        createdAt: new Date('2026-05-24T12:00:00.000Z'),
        monitor: {
          id: 'monitor-1',
          name: 'Main API',
          type: MonitorType.HTTP,
          isActive: true,
          lastCheckedAt: new Date('2026-05-24T12:00:00.000Z'),
          checkResults: [
            {
              checkedAt: new Date('2026-05-24T12:00:00.000Z'),
              isUp: true,
              error: null,
            },
          ],
          incidents: [],
        },
      },
    ],
  };

  beforeEach(() => {
    statusPagesRepository = {
      countByUserId: jest.fn(),
      findManyByUserId: jest.fn(),
      findOwnedById: jest.fn(),
      findBySlug: jest.fn(),
      findPublicBySlug: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<StatusPagesRepository>;

    monitorsRepository = {
      findManyOwnedByIds: jest.fn(),
    } as unknown as jest.Mocked<MonitorsRepository>;

    statusPagesService = new StatusPagesService(
      statusPagesRepository,
      monitorsRepository,
    );
  });

  it('lists paginated status pages for the authenticated user', async () => {
    statusPagesRepository.findManyByUserId.mockResolvedValue([
      baseStatusPage,
    ] as never);
    statusPagesRepository.countByUserId.mockResolvedValue(1);

    const result = await statusPagesService.listStatusPages(user, {
      page: 1,
      limit: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.overallStatus).toBe('OPERATIONAL');
    expect(result.meta.total).toBe(1);
  });

  it('creates a status page and associates owned monitors', async () => {
    statusPagesRepository.findBySlug.mockResolvedValue(null);
    monitorsRepository.findManyOwnedByIds.mockResolvedValue([
      {
        id: 'monitor-1',
      },
    ] as never);
    statusPagesRepository.create.mockResolvedValue({
      id: 'status-page-1',
    } as StatusPage);
    statusPagesRepository.findOwnedById.mockResolvedValue(baseStatusPage as never);

    const result = await statusPagesService.createStatusPage(user, {
      slug: 'api-production',
      name: 'API Production',
      description: ' Public production status page ',
      isPublic: true,
      monitorIds: ['monitor-1'],
    });

    expect(result.slug).toBe('api-production');
    expect(statusPagesRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: 'api-production',
        name: 'API Production',
      }),
    );
  });

  it('rejects creation when the slug is already in use', async () => {
    statusPagesRepository.findBySlug.mockResolvedValue({
      id: 'existing-status-page',
      slug: 'api-production',
    } as StatusPage);

    await expect(
      statusPagesService.createStatusPage(user, {
        slug: 'api-production',
        name: 'API Production',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects creation when any associated monitor is not owned by the user', async () => {
    statusPagesRepository.findBySlug.mockResolvedValue(null);
    monitorsRepository.findManyOwnedByIds.mockResolvedValue([] as never);

    await expect(
      statusPagesService.createStatusPage(user, {
        slug: 'api-production',
        name: 'API Production',
        monitorIds: ['monitor-1'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates a status page and replaces associated monitors when provided', async () => {
    statusPagesRepository.findOwnedById
      .mockResolvedValueOnce(baseStatusPage as never)
      .mockResolvedValueOnce({
        ...baseStatusPage,
        slug: 'api-public',
      } as never);
    statusPagesRepository.findBySlug.mockResolvedValue(null);
    monitorsRepository.findManyOwnedByIds.mockResolvedValue([
      {
        id: 'monitor-1',
      },
    ] as never);
    statusPagesRepository.update.mockResolvedValue({
      id: 'status-page-1',
    } as StatusPage);

    const result = await statusPagesService.updateStatusPage(user, 'status-page-1', {
      slug: 'api-public',
      monitorIds: ['monitor-1'],
    });

    expect(result.slug).toBe('api-public');
    expect(statusPagesRepository.update).toHaveBeenCalledWith(
      'status-page-1',
      expect.objectContaining({
        slug: 'api-public',
      }),
    );
  });

  it('returns a public status page by slug', async () => {
    statusPagesRepository.findPublicBySlug.mockResolvedValue(baseStatusPage as never);

    const result = await statusPagesService.getPublicStatusPage('api-production');

    expect(result.slug).toBe('api-production');
    expect(result.overallStatus).toBe('OPERATIONAL');
  });

  it('throws when the public slug does not exist or is private', async () => {
    statusPagesRepository.findPublicBySlug.mockResolvedValue(null);

    await expect(
      statusPagesService.getPublicStatusPage('missing-page'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
