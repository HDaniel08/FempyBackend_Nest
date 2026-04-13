import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DailyQuestionSchedulerService {
  private readonly logger = new Logger(DailyQuestionSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSchedules() {
    // Később ide jön:
    // - ONE_TIME schedule-k futtatása
    // - CRON schedule-k ellenőrzése
    // - default weekday morning küldések kezelése

    this.logger.debug('Daily question scheduler tick');
  }
}