import { Plan } from '@prisma/client';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let usersController: UsersController;
  let usersService: jest.Mocked<UsersService>;

  beforeEach(() => {
    usersService = {
      createUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      }),
      listVisibleUsers: jest.fn().mockResolvedValue({
        items: [
          {
            id: 'user-1',
            email: 'john@uptimewatch.dev',
            plan: Plan.FREE,
            dodoCustomerId: null,
          },
        ],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
        },
      }),
      getCurrentUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      }),
      getPlanLimitsForUser: jest.fn().mockResolvedValue({
        plan: Plan.FREE,
        limits: {
          maxMonitors: 5,
          minMonitorIntervalSeconds: 300,
          maxAlertContacts: 1,
        },
      }),
      getUserById: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'john@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      }),
      updateUser: jest.fn().mockResolvedValue({
        id: 'user-1',
        email: 'john.updated@uptimewatch.dev',
        plan: Plan.FREE,
        dodoCustomerId: null,
      }),
      deleteUser: jest.fn().mockResolvedValue({
        message: 'User deleted successfully',
      }),
    } as unknown as jest.Mocked<UsersService>;

    usersController = new UsersController(usersService);
  });

  it('creates a user account', async () => {
    const result = await usersController.create({
      email: 'john@uptimewatch.dev',
      password: 'SecurePass123',
    });

    expect(result.email).toBe('john@uptimewatch.dev');
    expect(usersService.createUser).toHaveBeenCalled();
  });

  it('returns visible users with pagination', async () => {
    const result = await usersController.findAll(
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

    expect(result.meta.total).toBe(1);
    expect(usersService.listVisibleUsers).toHaveBeenCalledWith('user-1', {
      page: 1,
      limit: 10,
    });
  });

  it('returns the limits of the current user plan', async () => {
    const result = await usersController.getMyPlanLimits({
      id: 'user-1',
      email: 'john@uptimewatch.dev',
      plan: Plan.FREE,
      dodoCustomerId: null,
    });

    expect(result.plan).toBe(Plan.FREE);
  });
});
