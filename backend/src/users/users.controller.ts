import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { AuthRateLimit } from '../common/decorators/auth-rate-limit.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AuthRateLimit()
  @ApiCreatedResponse({
    description: 'Create a user account without creating a login session',
  })
  @ApiOperation({
    summary: 'Create a user account',
  })
  create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUser(createUserDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Paginated list of users visible to the authenticated requester',
  })
  @ApiOperation({
    summary: 'List visible users with pagination',
  })
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() paginationQueryDto: PaginationQueryDto,
  ) {
    return this.usersService.listVisibleUsers(user.id, paginationQueryDto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Get the current authenticated user profile',
  })
  @ApiOperation({
    summary: 'Get the current user profile',
  })
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getCurrentUser(user.id);
  }

  @Get('me/limits')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Get plan-based limits for the current authenticated user',
  })
  @ApiOperation({
    summary: 'Get current plan limits',
  })
  getMyPlanLimits(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getPlanLimitsForUser(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Get a user by id when it belongs to the authenticated requester',
  })
  @ApiOperation({
    summary: 'Get a user by id',
  })
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.getUserById(user.id, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Update a user profile owned by the authenticated requester',
  })
  @ApiOperation({
    summary: 'Update a user profile',
  })
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(user.id, id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiCookieAuth()
  @ApiOkResponse({
    description: 'Delete a user owned by the authenticated requester',
  })
  @ApiOperation({
    summary: 'Delete a user',
  })
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.deleteUser(user.id, id);
  }
}
