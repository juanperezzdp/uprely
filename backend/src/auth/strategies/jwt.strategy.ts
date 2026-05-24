import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';
import type { EnvironmentVariables } from '../../config/env.schema';
import { UsersService } from '../../users/users.service';
import type { JwtPayload } from '../interfaces/jwt-payload.interface';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

type RequestWithCookies = Request & {
  cookies?: Record<string, string | undefined>;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService<EnvironmentVariables, true>,
    private readonly usersService: UsersService,
  ) {
    const cookieName = configService.getOrThrow('AUTH_COOKIE_NAME', {
      infer: true,
    });
    const jwtSecret = configService.getOrThrow('JWT_SECRET', {
      infer: true,
    });

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: RequestWithCookies | undefined): string | null => {
          if (!request?.cookies) {
            return null;
          }

          return request.cookies[cookieName] ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.usersService.findUserEntityById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Invalid authentication session');
    }

    return {
      id: user.id,
      email: user.email,
      plan: user.plan,
      dodoCustomerId: user.dodoCustomerId,
    };
  }
}
