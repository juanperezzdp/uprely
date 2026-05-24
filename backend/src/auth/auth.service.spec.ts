import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Plan, type User } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: {
    getOrThrow: jest.Mock<string, [string, { infer: true }]>;
  };

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
    usersService = {
      createUser: jest.fn(),
      findUserEntityByEmail: jest.fn(),
      findUserEntityById: jest.fn(),
    } as unknown as jest.Mocked<UsersService>;

    jwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt'),
    } as unknown as jest.Mocked<JwtService>;

    configService = {
      getOrThrow: jest.fn((key: string) => {
        switch (key) {
          case 'NODE_ENV':
            return 'test';
          case 'AUTH_COOKIE_NAME':
            return 'auth_token';
          default:
            return '7d';
        }
      }),
    };

    authService = new AuthService(
      usersService,
      jwtService,
      configService as unknown as ConfigService,
    );
  });

  it('registers a user, hashes the password and returns an auth token', async () => {
    usersService.createUser.mockResolvedValue({
      id: 'user-1',
      email: 'john@uptimewatch.dev',
      plan: Plan.FREE,
      dodoCustomerId: null,
    });

    const result = await authService.register({
      email: 'JOHN@uptimewatch.dev',
      password: 'SecurePass123',
    });

    expect(result.user).toEqual({
      id: 'user-1',
      email: 'john@uptimewatch.dev',
      plan: Plan.FREE,
      dodoCustomerId: null,
    });
    expect(usersService.createUser).toHaveBeenCalledWith({
      email: 'JOHN@uptimewatch.dev',
      password: 'SecurePass123',
    });
    expect(jwtService.signAsync).toHaveBeenCalledWith({
      sub: 'user-1',
      email: 'john@uptimewatch.dev',
      plan: Plan.FREE,
    });
  });

  it('rejects duplicate emails during registration', async () => {
    usersService.createUser.mockRejectedValue(
      new ConflictException('Email is already registered'),
    );

    await expect(
      authService.register({
        email: baseUser.email,
        password: 'SecurePass123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('logs in an existing user with valid credentials', async () => {
    usersService.findUserEntityByEmail.mockResolvedValue({
      ...baseUser,
      passwordHash: await hash('Password123', 12),
    });

    const result = await authService.login({
      email: baseUser.email,
      password: 'Password123',
    });

    expect(result.user.email).toBe(baseUser.email);
    expect(result.accessToken).toBe('signed-jwt');
  });

  it('rejects invalid credentials on login', async () => {
    usersService.findUserEntityByEmail.mockResolvedValue(null);

    await expect(
      authService.login({
        email: 'missing@uptimewatch.dev',
        password: 'SecurePass123',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
