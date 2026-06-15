import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ExpoPushService } from './expo-push.service';
import { Prisma } from '@prisma/client';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';

/**
 * NotificationsService:
 * - Controllerből / más service-ből ezt fogjuk hívni.
 * - Létrehozunk DB log rekordot (notification_jobs),
 * - majd enqueue-oljuk BullMQ-ba.
 */
@Injectable()
export class NotificationsService {
  constructor(
    private prisma: PrismaService,
    private expoPush: ExpoPushService,
    private readonly workSchedule: WorkScheduleService,

    // Ezzel kapjuk meg a "notifications" queue-t
    @InjectQueue('notifications') private queue: Queue,
  ) {}

  /**
   * Ütemezett értesítés (delayed job).
   * @param scheduledFor - mikor menjen ki (Date)
   */
  async scheduleNotification(input: {
    tenantId: string;
    userId: string;
    type: string;
    payload: any;
    scheduledFor: Date;
  }) {
    const scheduledFor = await this.workSchedule.nextAllowedAt(
      input.tenantId,
      input.scheduledFor,
    );
    // 1) DB log rekord
    const record = await this.prisma.notificationJob.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        payload: input.payload,
        scheduledFor,
        status: 'queued',
      },
    });

    // 2) Kiszámoljuk a delay-t (ms)
    const delayMs = Math.max(0, scheduledFor.getTime() - Date.now());

    // 3) BullMQ job hozzáadás
    await this.queue.add(
      'send', // job neve (típus)
      {
        notificationJobId: record.id,
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        payload: input.payload,
      },
      {
        delay: delayMs, // ✅ időzítés
        attempts: 3, // ✅ retry
        backoff: { type: 'exponential', delay: 2000 }, // ✅ fokozatos visszálkozás
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return record;
  }

  /**
   * Azonnali értesítés (delay nélkül).
   */
  async sendNow(input: {
    tenantId: string;
    userId: string;
    type: string;
    payload: any;
    dedupeKey?: string;
  }) {
    const workStatus = await this.workSchedule.getStatus(input.tenantId);
    const scheduledFor = workStatus.allowed ? null : workStatus.nextStart;
    let record;
    try {
      record = await this.prisma.notificationJob.create({
        data: {
          tenantId: input.tenantId,
          userId: input.userId,
          type: input.type,
          dedupeKey: input.dedupeKey,
          payload: input.payload,
          scheduledFor,
          status: 'queued',
        },
      });
    } catch (error) {
      if (
        input.dedupeKey &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.notificationJob.findUniqueOrThrow({
          where: { dedupeKey: input.dedupeKey },
        });
        return { ...existing, deduplicated: true };
      }
      throw error;
    }

    await this.queue.add(
      'send',
      {
        notificationJobId: record.id,
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        payload: input.payload,
      },
      {
        delay: scheduledFor
          ? Math.max(0, scheduledFor.getTime() - Date.now())
          : undefined,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return { ...record, deduplicated: false };
  }

  async scheduleBullmqHealthCheck(input: {
    tenantId: string;
    delayMs?: number;
    requestedBy?: string | null;
  }) {
    const delayMs = Math.max(0, Math.min(Number(input.delayMs ?? 5000), 60000));
    const scheduledFor = new Date(Date.now() + delayMs);
    const record = await this.prisma.notificationJob.create({
      data: {
        tenantId: input.tenantId,
        userId: null,
        type: 'bullmq_health_check',
        payload: {
          requestedBy: input.requestedBy ?? null,
          delayMs,
          enqueuedAt: new Date().toISOString(),
        },
        scheduledFor,
        status: 'queued',
      },
    });

    await this.queue.add(
      'health-check',
      {
        notificationJobId: record.id,
        tenantId: input.tenantId,
        requestedBy: input.requestedBy ?? null,
        enqueuedAt: new Date().toISOString(),
      },
      {
        delay: delayMs,
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return record;
  }

  async sendDirectNow(input: {
    tenantId: string;
    userId: string;
    type: string;
    payload: any;
  }) {
    const workStatus = await this.workSchedule.getStatus(input.tenantId);
    if (!workStatus.allowed) {
      return this.sendNow(input);
    }

    const record = await this.prisma.notificationJob.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        payload: input.payload,
        status: 'queued',
      },
    });

    try {
      return await this.deliverNotification(record.id, input);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return this.prisma.notificationJob.update({
        where: { id: record.id },
        data: {
          status: 'failed',
          errorMessage,
          processedAt: new Date(),
        },
      });
    }
  }

  private async deliverNotification(
    notificationJobId: string,
    input: {
      tenantId: string;
      userId: string;
      payload: any;
    },
  ) {
    const devices = await this.prisma.userDevice.findMany({
      where: { tenantId: input.tenantId, userId: input.userId },
      select: { id: true, expoToken: true },
    });

    const tokens = devices.map((device) => device.expoToken);
    const result = await this.expoPush.sendToTokens({
      tokens,
      title: input.payload?.title ?? 'Fempy',
      body: input.payload?.body ?? 'Teszt értesítés',
      data: input.payload?.data ?? {},
    });

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
          tenantId: input.tenantId,
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

      return this.prisma.notificationJob.update({
        where: { id: notificationJobId },
        data: {
          status: 'failed',
          errorMessage,
          processedAt: new Date(),
        },
      });
    }

    return this.prisma.notificationJob.update({
      where: { id: notificationJobId },
      data: {
        status: 'sent',
        processedAt: new Date(),
      },
    });
  }
}
