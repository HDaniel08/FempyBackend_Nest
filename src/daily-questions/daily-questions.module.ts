import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DailyQuestionsAdminController } from './controllers/daily-questions-admin.controller';
import { DailyQuestionsUserController } from './controllers/daily-questions-user.controller';
import { DailyQuestionsService } from './services/daily-questions.service';
import { DailyQuestionSchedulesService } from './services/daily-question-schedules.service';
import { DailyQuestionDispatchService } from './services/daily-question-dispatch.service';
import { DailyQuestionAnswerService } from './services/daily-question-answer.service';
import { DailyQuestionAudienceService } from './services/daily-question-audience.service';
import { DailyQuestionPushService } from './services/daily-question-push.service';
import { PrismaService } from '../prisma/prisma.service';
import { DailyQuestionSchedulerService } from './services/daily-question-scheduler.service';
import { DailyQuestionTopicReportService } from './services/daily-question-topic-report.service';
import { DailyQuestionCampaignsService } from './services/daily-question-campaigns.service';
import { ActivityModule } from '../activity/activity.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ActivityModule, NotificationsModule, ScheduleModule.forRoot()],
  controllers: [DailyQuestionsAdminController, DailyQuestionsUserController],
  providers: [
    PrismaService,
    DailyQuestionsService,
    DailyQuestionDispatchService,
    DailyQuestionAnswerService,
    DailyQuestionAudienceService,
    DailyQuestionPushService,
    DailyQuestionSchedulesService,
    DailyQuestionSchedulerService,
    DailyQuestionTopicReportService,
    DailyQuestionCampaignsService,
  ],
  exports: [
    DailyQuestionsService,
    DailyQuestionSchedulerService,
    DailyQuestionDispatchService,
    DailyQuestionAnswerService,
    DailyQuestionTopicReportService,
    DailyQuestionCampaignsService,
  ],
})
export class DailyQuestionsModule {}
