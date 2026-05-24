import { Injectable } from '@nestjs/common';
import { Prisma, type AlertContact } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AlertsRepository {
  constructor(private readonly prismaService: PrismaService) {}

  countByUserId(userId: string): Promise<number> {
    return this.prismaService.alertContact.count({
      where: {
        userId,
      },
    });
  }

  findManyByUserId(params: {
    userId: string;
    skip: number;
    take: number;
  }): Promise<AlertContact[]> {
    return this.prismaService.alertContact.findMany({
      where: {
        userId: params.userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: params.skip,
      take: params.take,
    });
  }

  findAllByUserId(userId: string): Promise<AlertContact[]> {
    return this.prismaService.alertContact.findMany({
      where: {
        userId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findOwnedById(userId: string, alertContactId: string): Promise<AlertContact | null> {
    return this.prismaService.alertContact.findFirst({
      where: {
        id: alertContactId,
        userId,
      },
    });
  }

  create(data: Prisma.AlertContactCreateInput): Promise<AlertContact> {
    return this.prismaService.alertContact.create({
      data,
    });
  }

  update(alertContactId: string, data: Prisma.AlertContactUpdateInput): Promise<AlertContact> {
    return this.prismaService.alertContact.update({
      where: {
        id: alertContactId,
      },
      data,
    });
  }

  delete(alertContactId: string): Promise<AlertContact> {
    return this.prismaService.alertContact.delete({
      where: {
        id: alertContactId,
      },
    });
  }
}
