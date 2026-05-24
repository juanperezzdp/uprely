import {
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { Plan, type User } from '@prisma/client';
import { compare } from 'bcrypt';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let usersService: UsersService;
  let usersRepository: jest.Mocked<UsersRepository>;

  const baseUser: User = {
    id: 'user-1',
    email: 'john@uptimewatch.dev',
    passwordHash: '$2b$12$7kPQnVWv40w3OC/YLXTr4eer2MvHfLgEy1o8ip4FKf2XWm.NQ6mQq',
    plan: Plan.FREE,
    dodoCustomerId: null,
    createdAt: new Date('2026-05-23T00:00:00.000Z'),
    updatedAt: new Date('2026-05-23T00:00:00.000Z'),
  };

  beforeEach(() => {
    usersRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findManyByIds: jest.fn(),
      countByIds: jest.fn(),
      countMonitorsByUserId: jest.fn(),
      countAlertContactsByUserId: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    usersService = new UsersService(usersRepository);
  });

  it('creates a new user with a hashed password and FREE plan by default', async () => {
    usersRepository.findByEmail.mockResolvedValue(null);
    usersRepository.create.mockImplementation(async ({ email, passwordHash, plan }) => ({
      ...baseUser,
      email,
      passwordHash,
      plan: plan ?? Plan.FREE,
    }));

    const result = await usersService.createUser({
      email: 'JOHN@uptimewatch.dev',
      password: 'SecurePass123',
    });

    expect(result).toEqual({
      id: 'user-1',
      email: 'john@uptimewatch.dev',
      plan: Plan.FREE,
      dodoCustomerId: null,
    });
    expect(
      await compare('SecurePass123', usersRepository.create.mock.calls[0][0].passwordHash),
    ).toBe(true);
  });

  it('returns paginated visible users for the authenticated requester', async () => {
    usersRepository.countByIds.mockResolvedValue(1);
    usersRepository.findManyByIds.mockResolvedValue([baseUser]);

    const result = await usersService.listVisibleUsers('user-1', {
      page: 1,
      limit: 10,
    });

    expect(result.meta.total).toBe(1);
    expect(result.items[0]?.id).toBe('user-1');
  });

  it('prevents one user from reading another user profile', async () => {
    await expect(usersService.getUserById('user-1', 'user-2')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects email changes that collide with another user', async () => {
    usersRepository.findById.mockResolvedValue(baseUser);
    usersRepository.findByEmail.mockResolvedValue({
      ...baseUser,
      id: 'user-2',
      email: 'existing@uptimewatch.dev',
    });

    await expect(
      usersService.updateUser('user-1', 'user-1', {
        email: 'existing@uptimewatch.dev',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects downgrading to FREE when the user exceeds FREE plan limits', async () => {
    usersRepository.findById.mockResolvedValue({
      ...baseUser,
      plan: Plan.PRO,
      dodoCustomerId: 'dodo_123',
    });
    usersRepository.countMonitorsByUserId.mockResolvedValue(6);
    usersRepository.countAlertContactsByUserId.mockResolvedValue(1);

    await expect(
      usersService.updatePlanForBilling({
        userId: 'user-1',
        plan: Plan.FREE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
