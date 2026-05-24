import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { AuthRateLimit } from '../common/decorators/auth-rate-limit.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { AuthenticatedUser } from './interfaces/authenticated-user.interface';
import { AuthService } from './auth.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @AuthRateLimit()
  @ApiOperation({
    summary: 'Register a new user and create an auth session',
  })
  register(
    @Body() registerDto: RegisterDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.handleAuthResponse(
      () => this.authService.register(registerDto),
      response,
    );
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @AuthRateLimit()
  @ApiOperation({
    summary: 'Login with email and password',
  })
  login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    return this.handleAuthResponse(() => this.authService.login(loginDto), response);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout and clear auth cookie',
  })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(
      this.authService.getAuthCookieName(),
      this.authService.getAuthCookieOptions(),
    );

    return this.authService.logout();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Authenticated user profile',
  })
  @ApiOperation({
    summary: 'Get the current authenticated user',
  })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }

  private async handleAuthResponse(
    action: () => Promise<{ user: AuthenticatedUser; accessToken: string }>,
    response: Response,
  ): Promise<{ user: AuthenticatedUser }> {
    const result = await action();

    response.cookie(
      this.authService.getAuthCookieName(),
      result.accessToken,
      this.authService.getAuthCookieOptions(),
    );

    return {
      user: result.user,
    };
  }
}
