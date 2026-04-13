import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

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
    // 1) DB log rekord
    const record = await this.prisma.notificationJob.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        payload: input.payload,
        scheduledFor: input.scheduledFor,
        status: 'queued',
      },
    });

    // 2) Kiszámoljuk a delay-t (ms)
    const delayMs = Math.max(0, input.scheduledFor.getTime() - Date.now());

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
        delay: delayMs,     // ✅ időzítés
        attempts: 3,        // ✅ retry
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
  async sendNow(input: { tenantId: string; userId: string; type: string; payload: any }) {
    const record = await this.prisma.notificationJob.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        type: input.type,
        payload: input.payload,
        status: 'queued',
      },
    });

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
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: true,
        removeOnFail: false,
      },
    );

    return record;
  }
}
