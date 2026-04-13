import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DailyQuestionPushService {
  private readonly logger = new Logger(DailyQuestionPushService.name);

  buildDefaultPush(topic: string) {
    return {
      title: 'Megérkezett a napi kérdőíved',
      body: `Töltsd ki ha szeretnél többet megtudni magadról a(z) ${topic}ben`,
    };
  }

  async sendToUsers(userIds: string[], payload: { title: string; body: string }) {
    this.logger.log(
      `Push küldés stub: users=${userIds.length}, title="${payload.title}"`,
    );

    // ide jön majd a valódi push integráció
    return {
      success: true,
      sentCount: userIds.length,
      payload,
    };
  }
}