import { Injectable, Logger } from '@nestjs/common';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class DailyQuestionPushService {
  private readonly logger = new Logger(DailyQuestionPushService.name);

  constructor(private readonly notifications: NotificationsService) {}

  buildDefaultPush(topic: string) {
    return {
      title: 'Megérkezett a napi kérdőíved',
      body: `Töltsd ki, ha szeretnél többet megtudni magadról a(z) ${topic} témában.`,
    };
  }

  async sendToUsers(
    tenantId: string,
    userIds: string[],
    payload: { title: string; body: string; data?: Record<string, any> },
    notificationDateKey: string,
  ) {
    this.logger.log(
      `Push jobok sorba állítása: users=${userIds.length}, title="${payload.title}"`,
    );

    const jobs = await Promise.all(
      userIds.map((userId) =>
        this.notifications.sendNow({
          tenantId,
          userId,
          type: 'daily_question',
          payload,
          dedupeKey: `${tenantId}:daily_question:${notificationDateKey}:${userId}`,
        }),
      ),
    );

    return {
      success: true,
      queuedCount: jobs.filter((job: any) => !job.deduplicated).length,
      deduplicatedCount: jobs.filter((job: any) => job.deduplicated).length,
      payload,
    };
  }
}
