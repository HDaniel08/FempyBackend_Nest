import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PositionsService {
  constructor(private prisma: PrismaService) {}

  async adminListPositions(tenantId: string) {
    return this.prisma.position.findMany({
      where: {
        tenantId,
        isDeleted: false,
      },
      include: {
        parent: {
          select: { id: true, name: true },
        },
        children: {
          where: { isDeleted: false },
          select: { id: true, name: true },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async adminCreatePosition(
    tenantId: string,
    input: {
      name: string;
      parentId?: string | null;
    },
  ) {
    if (input.parentId) {
      const parent = await this.prisma.position.findFirst({
        where: {
          id: input.parentId,
          tenantId,
          isDeleted: false,
        },
      });

      if (!parent) {
        throw new NotFoundException('A szülő pozíció nem található.');
      }
    }

    return this.prisma.position.create({
      data: {
        tenantId,
        name: input.name,
        parentId: input.parentId ?? null,
      },
    });
  }

  async adminUpdatePosition(
    tenantId: string,
    positionId: string,
    input: {
      name?: string;
      parentId?: string | null;
    },
  ) {
    const position = await this.prisma.position.findFirst({
      where: {
        id: positionId,
        tenantId,
        isDeleted: false,
      },
    });

    if (!position) {
      throw new NotFoundException('A pozíció nem található.');
    }

    if (input.parentId) {
      if (input.parentId === positionId) {
        throw new BadRequestException('A pozíció nem lehet saját maga szülője.');
      }

      const parent = await this.prisma.position.findFirst({
        where: {
          id: input.parentId,
          tenantId,
          isDeleted: false,
        },
      });

      if (!parent) {
        throw new NotFoundException('A szülő pozíció nem található.');
      }
    }

    return this.prisma.position.update({
      where: { id: positionId },
      data: {
        name: input.name,
        parentId: input.parentId,
      },
    });
  }

  async adminDeletePosition(tenantId: string, positionId: string) {
    const position = await this.prisma.position.findFirst({
      where: {
        id: positionId,
        tenantId,
        isDeleted: false,
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!position) {
      throw new NotFoundException('A pozíció nem található.');
    }

    if (position._count.users > 0) {
      throw new BadRequestException(
        'A pozícióhoz felhasználók tartoznak, előbb helyezd át őket.',
      );
    }

    // children áthelyezése parenthez
    await this.prisma.position.updateMany({
      where: {
        parentId: positionId,
        tenantId,
      },
      data: {
        parentId: position.parentId ?? null,
      },
    });

    // soft delete
    return this.prisma.position.update({
      where: { id: positionId },
      data: {
        isDeleted: true,
      },
    });
  }
}
