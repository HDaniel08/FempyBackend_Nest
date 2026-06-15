import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsController } from './notifications.controller';
import { ExpoPushService } from './expo-push.service';
import {
  buildRedisConnectionOptions,
  describeRedisConnection,
} from './redis-connection.config';
import { WorkScheduleModule } from '../work-schedule/work-schedule.module';
/**
 * NotificationsModule:
 * - Itt konfiguráljuk a BullMQ queue-t.
 * - A queue neve: "notifications"
 */
@Module({
  imports: [
    WorkScheduleModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connection = buildRedisConnectionOptions(config);
        console.log(
          `[BullMQ] Redis connection config: ${JSON.stringify(
            describeRedisConnection(config, connection),
          )}`,
        );
        return {
          connection,
        };
      },
    }),

    // Ebben a modulban regisztráljuk a queue-t
    BullModule.registerQueue({
      name: 'notifications',
    }),
  ],
  providers: [NotificationsService, NotificationsProcessor, ExpoPushService],
  exports: [NotificationsService],
  controllers: [NotificationsController],
})
export class NotificationsModule {}
