import { ConfigModule } from '@nestjs/config';
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { TenantMiddleware } from './common/tenant/tenant.middleware';
import { TenantsModule } from './tenants/tenants.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DevicesModule } from './devices/devices.module';
import { NotificationsModule } from './notifications/notifications.module';
import { DailyMoodModule } from './dialy-mood/daily-mood.module';
import { DailyQuestionsModule } from './daily-questions/daily-questions.module';

import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { HealthModule } from './health/health.module';
import { PublicModule } from './public/public.module';
import { PositionsModule } from './positions/positions.module';
import { AdminModule } from './admin/admin.module';
import { SuperAdminModule } from './super-admin/super-admin.module';
import { ContentModule } from './content/content.module';
import { UsageModule } from './usage/usage.module';
import { MailModule } from './mail/mail.module';
import { RemindersModule } from './reminders/reminders.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // így nem kell minden modulba importálni
    }),
    PrismaModule,
    PublicModule,
    HealthModule,
    TenantsModule,
    UsersModule,
    AuthModule,
    DevicesModule,
    NotificationsModule,
    DailyMoodModule,
    DailyQuestionsModule,
    PositionsModule,
    AdminModule,
    SuperAdminModule,
    ContentModule,
    UsageModule,
    MailModule,
    RemindersModule,

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    // ...
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
