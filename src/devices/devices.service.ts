import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DevicesService {
  constructor(private prisma: PrismaService) {}

  async registerDevice(input: {
    tenantId: string;
    userId: string;
    expoToken: string;
    deviceInfo?: any;
  }) {
    if (!input?.tenantId || typeof input.tenantId !== 'string') {
      throw new BadRequestException('Missing tenantId');
    }

    if (!input?.userId || typeof input.userId !== 'string') {
      throw new BadRequestException('Missing userId');
    }

    if (!input?.expoToken || typeof input.expoToken !== 'string') {
      throw new BadRequestException('Missing expoToken');
    }

    const existing = await this.prisma.userDevice.findFirst({
      where: {
        tenantId: input.tenantId,
        expoToken: input.expoToken,
      },
    });

    if (existing) {
      return this.prisma.userDevice.update({
        where: { id: existing.id },
        data: {
          userId: input.userId,
          deviceInfo: input.deviceInfo ?? existing.deviceInfo,
          lastSeenAt: new Date(),
        },
      });
    }

    return this.prisma.userDevice.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        expoToken: input.expoToken,
        deviceInfo: input.deviceInfo ?? null,
        lastSeenAt: new Date(),
      },
    });
  }
}