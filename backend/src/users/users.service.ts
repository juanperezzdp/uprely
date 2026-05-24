import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Plan, type User } from '@prisma/client';
import { hash } from 'bcrypt';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { PLAN_LIMITS, type PlanLimits } from './constants/plan-limits';
import type { CreateUserDto } from './dto/create-user.dto';
import type { PaginationQueryDto } from './dto/pagination-query.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';

export interface PaginatedUsersResponse {
  items: AuthenticatedUser[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async createUser(
    createUserDto: CreateUserDto,
    params?: {
      plan?: Plan;
      dodoCustomerId?: string | null;
    },
  ): Promise<AuthenticatedUser> {
    const email = createUserDto.email.trim().toLowerCase();
    const existingUser = await this.usersRepository.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await hash(createUserDto.password, 12);
    const user = await this.usersRepository.create({
      email,
      passwordHash,
      plan: params?.plan ?? Plan.FREE,
      dodoCustomerId: params?.dodoCustomerId ?? null,
    });

    return this.toAuthenticatedUser(user);
  }

  async listVisibleUsers(
    requesterId: string,
    paginationQueryDto: PaginationQueryDto,
  ): Promise<PaginatedUsersResponse> {
    const page = paginationQueryDto.page;
    const limit = paginationQueryDto.limit;
    const ids = [requesterId];
    const total = await this.usersRepository.countByIds(ids);
    const items = await this.usersRepository.findManyByIds({
      ids,
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: items.map((user) => this.toAuthenticatedUser(user)),
      meta: {
        page,
        limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / limit),
      },
    };
  }

  async getCurrentUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.getExistingUser(userId);

    return this.toAuthenticatedUser(user);
  }

  async getUserById(
    requesterId: string,
    targetUserId: string,
  ): Promise<AuthenticatedUser> {
    this.assertSelfAccess(requesterId, targetUserId);
    const user = await this.getExistingUser(targetUserId);

    return this.toAuthenticatedUser(user);
  }

  async updateUser(
    requesterId: string,
    targetUserId: string,
    updateUserDto: UpdateUserDto,
  ): Promise<AuthenticatedUser> {
    this.assertSelfAccess(requesterId, targetUserId);
    const currentUser = await this.getExistingUser(targetUserId);
    const nextEmail = updateUserDto.email?.trim().toLowerCase();

    if (nextEmail && nextEmail !== currentUser.email) {
      const userWithSameEmail = await this.usersRepository.findByEmail(nextEmail);

      if (userWithSameEmail && userWithSameEmail.id !== currentUser.id) {
        throw new ConflictException('Email is already registered');
      }
    }

    const passwordHash = updateUserDto.password
      ? await hash(updateUserDto.password, 12)
      : undefined;

    const updatedUser = await this.usersRepository.update(targetUserId, {
      email: nextEmail,
      passwordHash,
    });

    return this.toAuthenticatedUser(updatedUser);
  }

  async deleteUser(requesterId: string, targetUserId: string): Promise<{
    message: string;
  }> {
    this.assertSelfAccess(requesterId, targetUserId);
    await this.getExistingUser(targetUserId);
    await this.usersRepository.delete(targetUserId);

    return {
      message: 'User deleted successfully',
    };
  }

  async getPlanLimitsForUser(userId: string): Promise<{
    plan: Plan;
    limits: PlanLimits;
  }> {
    const user = await this.getExistingUser(userId);

    return {
      plan: user.plan,
      limits: PLAN_LIMITS[user.plan],
    };
  }

  async updatePlanForBilling(params: {
    userId: string;
    plan: Plan;
    dodoCustomerId?: string | null;
  }): Promise<AuthenticatedUser> {
    const user = await this.getExistingUser(params.userId);

    if (params.plan === Plan.FREE) {
      await this.assertPlanCanBeApplied(params.userId, Plan.FREE);
    }

    const updatedUser = await this.usersRepository.update(user.id, {
      plan: params.plan,
      dodoCustomerId:
        params.dodoCustomerId === undefined ? user.dodoCustomerId : params.dodoCustomerId,
    });

    return this.toAuthenticatedUser(updatedUser);
  }

  async findUserEntityByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findByEmail(email.trim().toLowerCase());
  }

  async findUserEntityById(id: string): Promise<User | null> {
    return this.usersRepository.findById(id);
  }

  private async getExistingUser(userId: string): Promise<User> {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  private async assertPlanCanBeApplied(userId: string, plan: Plan): Promise<void> {
    const limits = PLAN_LIMITS[plan];
    const [monitorCount, alertContactCount] = await Promise.all([
      this.usersRepository.countMonitorsByUserId(userId),
      this.usersRepository.countAlertContactsByUserId(userId),
    ]);

    if (monitorCount > limits.maxMonitors) {
      throw new ConflictException(
        `Plan ${plan} only allows up to ${limits.maxMonitors} monitors`,
      );
    }

    if (alertContactCount > limits.maxAlertContacts) {
      throw new ConflictException(
        `Plan ${plan} only allows up to ${limits.maxAlertContacts} alert contacts`,
      );
    }
  }

  private assertSelfAccess(requesterId: string, targetUserId: string): void {
    if (requesterId !== targetUserId) {
      throw new ForbiddenException('You can only manage your own user');
    }
  }

  private toAuthenticatedUser(user: User): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      plan: user.plan,
      dodoCustomerId: user.dodoCustomerId,
    };
  }
}
