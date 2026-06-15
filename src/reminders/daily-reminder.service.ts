import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';

const MOOD_REMINDER_AFTER_MS = 4 * 60 * 60 * 1000;
const QUESTION_REMINDER_AFTER_MS = 6 * 60 * 60 * 1000;

type ReminderResult = {
  tenantId: string;
  moodQueued: number;
  questionQueued: number;
};

@Injectable()
export class DailyReminderService {
  private readonly logger = new Logger(DailyReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly workSchedule: WorkScheduleService,
  ) {}

  @Cron('*/5 * * * *', { timeZone: 'Europe/Budapest' })
  async processReminders(now = new Date()) {
    const tenants = await this.prisma.tenant.findMany({
      where: { appAccessEnabled: true },
      select: { id: true },
    });

    const results: ReminderResult[] = [];
    for (const tenant of tenants) {
      const result = await this.processTenant(tenant.id, now);
      if (result.moodQueued || result.questionQueued) results.push(result);
    }

    if (results.length > 0) {
      this.logger.log(
        `Napi emlékeztetők: tenantok=${results.length}, kedv=${results.reduce(
          (sum, item) => sum + item.moodQueued,
          0,
        )}, kérdőív=${results.reduce(
          (sum, item) => sum + item.questionQueued,
          0,
        )}`,
      );
    }

    return results;
  }

  async processTenant(tenantId: string, now = new Date()) {
    const workStatus = await this.workSchedule.getStatus(tenantId, now);
    const startAt =
      'startAt' in workStatus ? workStatus.startAt : undefined;
    const endAt = 'endAt' in workStatus ? workStatus.endAt : undefined;

    if (!workStatus.allowed || !startAt || !endAt) {
      return { tenantId, moodQueued: 0, questionQueued: 0 };
    }

    const users = await this.prisma.user.findMany({
      where: {
        tenantId,
        isDeleted: false,
        OR: [
          { profile: { is: null } },
          {
            profile: {
              is: {
                dailyNotification: true,
                onHoliday: false,
              },
            },
          },
        ],
      },
      select: { id: true },
    });

    const moodDueAt = new Date(startAt.getTime() + MOOD_REMINDER_AFTER_MS);
    const questionDueAt = new Date(
      startAt.getTime() + QUESTION_REMINDER_AFTER_MS,
    );

    const [moodQueued, questionQueued] = await Promise.all([
      moodDueAt < endAt && now >= moodDueAt
        ? this.queueMoodReminders(
            tenantId,
            users.map((user) => user.id),
            workStatus.dateKey,
          )
        : 0,
      questionDueAt < endAt && now >= questionDueAt
        ? this.queueQuestionReminders(
            tenantId,
            users.map((user) => user.id),
            workStatus.dateKey,
          )
        : 0,
    ]);

    return { tenantId, moodQueued, questionQueued };
  }

  private async queueMoodReminders(
    tenantId: string,
    userIds: string[],
    dateKey: string,
  ) {
    if (userIds.length === 0) return 0;

    const date = this.dateKeyToUtcDate(dateKey);
    const completed = await this.prisma.dailyMood.findMany({
      where: { tenantId, userId: { in: userIds }, date },
      select: { userId: true },
    });
    const completedIds = new Set(completed.map((item) => item.userId));
    const pendingIds = userIds.filter((userId) => !completedIds.has(userId));

    const jobs = await Promise.all(
      pendingIds.map((userId) =>
        this.notifications.sendNow({
          tenantId,
          userId,
          type: 'daily_mood_reminder',
          dedupeKey: `${tenantId}:daily_mood_reminder:${dateKey}:${userId}`,
          payload: {
            title: 'Hogy érzed magad ma?',
            body: 'Egy pillanat is elég: jelöld be a mai kedved, hogy jobban lásd a saját ritmusodat.',
            data: { type: 'daily_mood_reminder', date: dateKey },
          },
        }),
      ),
    );

    return jobs.filter((job: any) => !job.deduplicated).length;
  }

  private async queueQuestionReminders(
    tenantId: string,
    userIds: string[],
    dateKey: string,
  ) {
    if (userIds.length === 0) return 0;

    const pending = await this.prisma.dailyQuestionnaireAnswer.groupBy({
      by: ['userId'],
      where: {
        tenantId,
        userId: { in: userIds },
        isActive: true,
        filledAt: null,
      },
      _count: { _all: true },
    });

    const jobs = await Promise.all(
      pending.map((item) =>
        this.notifications.sendNow({
          tenantId,
          userId: item.userId,
          type: 'daily_question_reminder',
          dedupeKey: `${tenantId}:daily_question_reminder:${dateKey}:${item.userId}`,
          payload: {
            title: 'Maradt még egy kis kérdőív',
            body: `Van még ${item._count._all} megválaszolatlan kérdésed. Amikor belefér, pár perc alatt végigérsz rajta.`,
            data: {
              type: 'daily_question_reminder',
              pendingCount: item._count._all,
            },
          },
        }),
      ),
    );

    return jobs.filter((job: any) => !job.deduplicated).length;
  }

  private dateKeyToUtcDate(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
