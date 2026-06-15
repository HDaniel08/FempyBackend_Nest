import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from './expo-push.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly expoPush: ExpoPushService,
    private readonly workSchedule: WorkScheduleService,
    @InjectQueue('notifications') private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job) {
    this.logger.log(`Job érkezett: id=${job.id} name=${job.name}`);
    this.logger.log(`Job data: ${JSON.stringify(job.data)}`);

    if (job.name === 'health-check') {
      const { notificationJobId, enqueuedAt, requestedBy } = job.data;
      await this.prisma.notificationJob.update({
        where: { id: notificationJobId },
        data: {
          status: 'sent',
          payload: {
            kind: 'bullmq_health_check',
            requestedBy: requestedBy ?? null,
            enqueuedAt: enqueuedAt ?? null,
            processedAt: new Date().toISOString(),
            workerJobId: String(job.id),
          },
          processedAt: new Date(),
        },
      });

      return { ok: true, notificationJobId };
    }

    const { tenantId, userId, payload, notificationJobId } = job.data;
    const workStatus = await this.workSchedule.getStatus(tenantId);

    if (!workStatus.allowed) {
      const delay = Math.max(0, workStatus.nextStart.getTime() - Date.now());
      await this.prisma.notificationJob.update({
        where: { id: notificationJobId },
        data: {
          status: 'queued',
          scheduledFor: workStatus.nextStart,
        },
      });
      await this.queue.add('send', job.data, {
        delay,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      });
      return {
        deferred: true,
        notificationJobId,
        scheduledFor: workStatus.nextStart,
      };
    }

    const devices = await this.prisma.userDevice.findMany({
      where: { tenantId, userId },
      select: { id: true, expoToken: true },
    });

    const tokens = devices.map((device) => device.expoToken);

    const result = await this.expoPush.sendToTokens({
      tokens,
      title: payload?.title ?? 'Fempy',
      body: payload?.body ?? 'Teszt értesítés',
      data: payload?.data ?? {},
    });

    this.logger.log(`Expo tickets: ${JSON.stringify(result.tickets)}`);
    this.logger.log(`Invalid tokens: ${JSON.stringify(result.invalidTokens)}`);

    const ticketErrors = result.tickets.filter(
      (ticket: any) => ticket.status === 'error',
    );

    const deviceNotRegisteredTokens = ticketErrors
      .filter((ticket: any) => ticket.details?.error === 'DeviceNotRegistered')
      .map((ticket: any) => {
        const index = result.tickets.indexOf(ticket);
        return devices[index]?.expoToken;
      })
      .filter(Boolean);

    if (deviceNotRegisteredTokens.length > 0) {
      await this.prisma.userDevice.deleteMany({
        where: {
          tenantId,
          expoToken: { in: deviceNotRegisteredTokens },
        },
      });
    }

    if (ticketErrors.length > 0) {
      const errorMessage = ticketErrors
        .map(
          (ticket: any) =>
            `${ticket.details?.error ?? 'ExpoError'}: ${ticket.message}`,
        )
        .join(' | ');

      await this.prisma.notificationJob.update({
        where: { id: notificationJobId },
        data: {
          status: 'failed',
          errorMessage,
          processedAt: new Date(),
        },
      });

      this.logger.error(`Expo push ticket hiba: ${errorMessage}`);
      return { sentTo: tokens.length, ...result, failed: ticketErrors.length };
    }

    await this.prisma.notificationJob.update({
      where: { id: notificationJobId },
      data: {
        status: 'sent',
        processedAt: new Date(),
      },
    });

    return { sentTo: tokens.length, ...result };
  }
}
