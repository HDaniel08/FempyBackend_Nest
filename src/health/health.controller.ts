import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async getHealth() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        ok: true,
        db: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch (e) {
      return {
        ok: false,
        db: 'error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}