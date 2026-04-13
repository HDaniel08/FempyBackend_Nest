import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from './expo-push.service';
import { Logger } from '@nestjs/common';
@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPush: ExpoPushService,
  ) {
    super();
  }

  async process(job: Job) {
     this.logger.log(`Job érkezett: id=${job.id} name=${job.name}`);
    this.logger.log(`Job data: ${JSON.stringify(job.data)}`);
    // A job.data felépítését a saját NotificationsService-ünk adja.
    const { tenantId, userId, payload } = job.data;

    // 1) Lekérjük a user eszközeit (expo tokenek)
    // ⚠️ Itt lehet nálad más a model/mező neve!
    const devices = await this.prisma.userDevice.findMany({
      where: { tenantId, userId },
      select: { expoToken: true },
    });

    const tokens = devices.map((d) => d.expoToken);

    // 2) Küldés Expo felé
    const result = await this.expoPush.sendToTokens({
      tokens,
      title: payload?.title ?? 'Fempy',
      body: payload?.body ?? 'Teszt értesítés',
      data: payload?.data ?? {},
    });
    this.logger.log(`Expo tickets: ${JSON.stringify(result.tickets)}`);
this.logger.log(`Invalid tokens: ${JSON.stringify(result.invalidTokens)}`);

    return { sentTo: tokens.length, ...result };
  }
}
