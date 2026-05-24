import { Injectable } from '@nestjs/common';
import { Plan, type Prisma, type User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersRepository {
  constructor(private readonly prismaService: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
  }

  findById(id: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: {
        id,
      },
    });
  }

  create(params: {
    email: string;
    passwordHash: string;
    plan?: Plan;
    dodoCustomerId?: string | null;
  }): Promise<User> {
    return this.prismaService.user.create({
      data: {
        email: params.email,
        passwordHash: params.passwordHash,
        plan: params.plan,
        dodoCustomerId: params.dodoCustomerId,
      },
    });
  }

  update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return this.prismaService.user.update({
      where: {
        id,
      },
      data,
    });
  }

  delete(id: string): Promise<User> {
    return this.prismaService.user.delete({
      where: {
        id,
      },
    });
  }

  findManyByIds(params: {
    ids: string[];
    skip: number;
    take: number;
  }): Promise<User[]> {
    return this.prismaService.user.findMany({
      where: {
        id: {
          in: params.ids,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: params.skip,
      take: params.take,
    });
  }

  countByIds(ids: string[]): Promise<number> {
    return this.prismaService.user.count({
      where: {
        id: {
          in: ids,
        },
      },
    });
  }

  countMonitorsByUserId(userId: string): Promise<number> {
    return this.prismaService.monitor.count({
      where: {
        userId,
      },
    });
  }

  countAlertContactsByUserId(userId: string): Promise<number> {
    return this.prismaService.alertContact.count({
      where: {
        userId,
      },
    });
  }
}
