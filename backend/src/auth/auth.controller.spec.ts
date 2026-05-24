import { Plan } from '@prisma/client';
import type { Response } from 'express';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: jest.Mocked<AuthService>;

  const user: AuthenticatedUser = {
    id: 'user-1',
    email: 'john@uptimewatch.dev',
    plan: Plan.FREE,
    dodoCustomerId: null,
  };

  beforeEach(() => {
    authService = {
      register: jest.fn().mockResolvedValue({
        user,
        accessToken: 'jwt-token',
      }),
      login: jest.fn().mockResolvedValue({
        user,
        accessToken: 'jwt-token',
      }),
      logout: jest.fn().mockReturnValue({
        message: 'Logged out successfully',
      }),
      me: jest.fn().mockReturnValue(user),
      getAuthCookieName: jest.fn().mockReturnValue('auth_token'),
      getAuthCookieOptions: jest.fn().mockReturnValue({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
      }),
    } as unknown as jest.Mocked<AuthService>;

    authController = new AuthController(authService);
  });

  it('registers and sets the auth cookie', async () => {
    const response = {
      cookie: jest.fn(),
    } as unknown as Response;

    const result = await authController.register(
      {
        email: 'john@uptimewatch.dev',
        password: 'SecurePass123',
      },
      response,
    );

    expect(result).toEqual({
      user,
    });
    expect(authService.register).toHaveBeenCalled();
    expect(response.cookie).toHaveBeenCalledWith(
      'auth_token',
      'jwt-token',
      expect.objectContaining({
        httpOnly: true,
      }),
    );
  });

  it('clears the auth cookie on logout', () => {
    const response = {
      clearCookie: jest.fn(),
    } as unknown as Response;

    const result = authController.logout(response);

    expect(result).toEqual({
      message: 'Logged out successfully',
    });
    expect(response.clearCookie).toHaveBeenCalledWith(
      'auth_token',
      expect.objectContaining({
        path: '/',
      }),
    );
  });

  it('returns the authenticated user for /auth/me', () => {
    expect(authController.me(user)).toEqual(user);
    expect(authService.me).toHaveBeenCalledWith(user);
  });
});
