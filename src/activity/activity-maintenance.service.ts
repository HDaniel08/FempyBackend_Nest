import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityMaintenanceService {
  private readonly logger = new Logger(ActivityMaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 3 * * *')
  async cleanupExpiredActivity() {
    const result = await this.cleanup();
    this.logger.log(
      `Activity cleanup removed app=${result.app.deletedCount}, audit=${result.audit.deletedCount}, system=${result.system.deletedCount}`,
    );
  }

  async cleanup(options?: { appDays?: number; auditDays?: number; systemDays?: number }) {
    const appBefore = this.daysAgo(options?.appDays ?? 180);
    const auditBefore = this.daysAgo(options?.auditDays ?? 730);
    const systemBefore = this.daysAgo(options?.systemDays ?? 365);

    const [app, audit, system] = await Promise.all([
      this.prisma.activityEvent.deleteMany({
        where: { category: 'APP', createdAt: { lt: appBefore } },
      }),
      this.prisma.activityEvent.deleteMany({
        where: { category: 'AUDIT', createdAt: { lt: auditBefore } },
      }),
      this.prisma.activityEvent.deleteMany({
        where: { category: 'SYSTEM', createdAt: { lt: systemBefore } },
      }),
    ]);

    await this.prisma.supportSession.updateMany({
      where: {
        status: 'active',
        startedAt: { lt: this.daysAgo(2) },
      },
      data: {
        status: 'expired',
        endedAt: new Date(),
      },
    });

    return {
      app: { deletedCount: app.count },
      audit: { deletedCount: audit.count },
      system: { deletedCount: system.count },
    };
  }

  private daysAgo(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    return date;
  }
}
