import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkScheduleModule } from '../work-schedule/work-schedule.module';
import { DailyReminderService } from './daily-reminder.service';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    WorkScheduleModule,
  ],
  providers: [DailyReminderService],
})
export class RemindersModule {}
