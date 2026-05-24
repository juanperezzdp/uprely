import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import type { CookieOptions } from 'express';
import type { EnvironmentVariables } from '../config/env.schema';
import { UsersService } from '../users/users.service';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import type { JwtPayload } from './interfaces/jwt-payload.interface';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';

interface AuthResult {
  user: AuthenticatedUser;
  accessToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async register(registerDto: RegisterDto): Promise<AuthResult> {
    const user = await this.usersService.createUser(registerDto);

    return {
      user,
      accessToken: await this.signToken({
        sub: user.id,
        email: user.email,
        plan: user.plan,
      }),
    };
  }

  async login(loginDto: LoginDto): Promise<AuthResult> {
    const email = loginDto.email.trim().toLowerCase();
    const user = await this.usersService.findUserEntityByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordMatches = await compare(loginDto.password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return {
      user: this.toAuthenticatedUser(user),
      accessToken: await this.signToken({
        sub: user.id,
        email: user.email,
        plan: user.plan,
      }),
    };
  }

  logout(): { message: string } {
    return {
      message: 'Logged out successfully',
    };
  }

  me(user: AuthenticatedUser): AuthenticatedUser {
    return user;
  }

  getAuthCookieOptions(): CookieOptions {
    const isProduction =
      this.configService.getOrThrow('NODE_ENV', {
        infer: true,
      }) === 'production';

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    };
  }

  getAuthCookieName(): string {
    return this.configService.getOrThrow('AUTH_COOKIE_NAME', {
      infer: true,
    });
  }

  private signToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload);
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    plan: AuthenticatedUser['plan'];
    dodoCustomerId: string | null;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      plan: user.plan,
      dodoCustomerId: user.dodoCustomerId,
    };
  }
}
