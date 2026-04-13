import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { NotificationsProcessor } from './notifications.processor';
import { NotificationsController } from './notifications.controller';
import { ExpoPushService } from './expo-push.service';
/**
 * NotificationsModule:
 * - Itt konfiguráljuk a BullMQ queue-t.
 * - A queue neve: "notifications"
 */
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST') ?? 'localhost',
          port: Number(config.get<string>('REDIS_PORT') ?? 6379),
        },
      }),
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
