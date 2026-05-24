import { Plan } from '@prisma/client';
import { StatusPagesController } from './status-pages.controller';
import { StatusPagesService } from './status-pages.service';

describe('StatusPagesController', () => {
  let statusPagesController: StatusPagesController;
  let statusPagesService: jest.Mocked<StatusPagesService>;

  beforeEach(() => {
    statusPagesService = {
      listStatusPages: jest.fn(),
      createStatusPage: jest.fn(),
      getStatusPage: jest.fn(),
      updateStatusPage: jest.fn(),
      deleteStatusPage: jest.fn(),
      getPublicStatusPage: jest.fn(),
    } as unknown as jest.Mocked<StatusPagesService>;

    statusPagesController = new StatusPagesController(statusPagesService);
  });

  it('delegates authenticated status page listing to the service', () => {
    statusPagesService.listStatusPages.mockResolvedValue({
      items: [],
      meta: {
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 0,
      },
    });

    const result = statusPagesController.findAll(
      {
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      },
      {
        page: 1,
        limit: 10,
      },
    );

    expect(statusPagesService.listStatusPages).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('delegates public status page lookups by slug', () => {
    statusPagesService.getPublicStatusPage.mockResolvedValue({
      slug: 'api-production',
      name: 'API Production',
      description: null,
      overallStatus: 'OPERATIONAL',
      monitors: [],
      updatedAt: '2026-05-24T12:00:00.000Z',
    });

    const result = statusPagesController.findPublic('api-production');

    expect(statusPagesService.getPublicStatusPage).toHaveBeenCalledWith(
      'api-production',
    );
    expect(result).toBeDefined();
  });
});
