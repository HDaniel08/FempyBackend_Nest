import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityModule } from '../activity/activity.module';
import { ContentModule } from '../content/content.module';
import { UsageModule } from '../usage/usage.module';
import { MailModule } from '../mail/mail.module';
import { DailyQuestionsModule } from '../daily-questions/daily-questions.module';
import { AppVersionModule } from '../app-version/app-version.module';
import { SuperAdminController } from './super-admin.controller';
import { SuperAdminGuard } from './super-admin.guard';
import { SuperAdminService } from './super-admin.service';

@Module({
  imports: [
    PrismaModule,
    NotificationsModule,
    ActivityModule,
    ContentModule,
    UsageModule,
    MailModule,
    DailyQuestionsModule,
    AppVersionModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-secret',
        signOptions: { expiresIn: '12h' },
      }),
    }),
  ],
  controllers: [SuperAdminController],
  providers: [SuperAdminService, SuperAdminGuard],
})
export class SuperAdminModule {}
