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
      useFactory: (config: ConfigService) => {
        const redisUrl =
          config.get<string>('REDIS_URL') ||
          config.get<string>('REDIS_PRIVATE_URL') ||
          config.get<string>('REDIS_PUBLIC_URL') ||
          config.get<string>('REDIS_TLS_URL');

        if (redisUrl) {
          const url = new URL(redisUrl);
          const tlsEnabled =
            url.protocol === 'rediss:' ||
            config.get<string>('REDIS_TLS') === 'true';

          return {
            connection: {
              host: url.hostname,
              port: Number(url.port || 6379),
              family: 0,
              username:
                decodeURIComponent(url.username) ||
                config.get<string>('REDIS_USERNAME') ||
                undefined,
              password:
                decodeURIComponent(url.password) ||
                config.get<string>('REDIS_PASSWORD') ||
                undefined,
              tls: tlsEnabled ? {} : undefined,
            },
          };
        }

        return {
          connection: {
            host: config.get<string>('REDIS_HOST') ?? 'localhost',
            port: Number(config.get<string>('REDIS_PORT') ?? 6379),
            family: 0,
            username: config.get<string>('REDIS_USERNAME') || undefined,
            password: config.get<string>('REDIS_PASSWORD') || undefined,
            tls: config.get<string>('REDIS_TLS') === 'true' ? {} : undefined,
          },
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
