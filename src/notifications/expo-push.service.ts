import { Injectable, Logger } from '@nestjs/common';
import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';

@Injectable()
export class ExpoPushService {
  private readonly logger = new Logger(ExpoPushService.name);
  private readonly expo = new Expo();

  /**
   * Több tokenre küld push-t. Chunkolás kötelező az Expo limit miatt.
   */
  async sendToTokens(params: {
    tokens: string[];
    title: string;
    body: string;
    data?: Record<string, any>;
  }): Promise<{ tickets: ExpoPushTicket[]; invalidTokens: string[] }> {
    const invalidTokens: string[] = [];

    const messages: ExpoPushMessage[] = params.tokens
      .map((t) => t?.trim())
      .filter(Boolean)
      .filter((t) => {
        const ok = Expo.isExpoPushToken(t);
        if (!ok) invalidTokens.push(t);
        return ok;
      })
      .map((t) => ({
        to: t,
        sound: 'default',
        title: params.title,
        body: params.body,
        data: params.data ?? {},
      }));

    if (messages.length === 0) {
      this.logger.warn('Nincs érvényes Expo token, nem küldünk push-t.');
      return { tickets: [], invalidTokens };
    }

    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets: ExpoPushTicket[] = [];

    for (const chunk of chunks) {
      const chunkTickets = await this.expo.sendPushNotificationsAsync(chunk);
      tickets.push(...chunkTickets);
    }

    return { tickets, invalidTokens };
  }
}
