import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DailyQuestionDispatchService } from './daily-question-dispatch.service';

@Injectable()
export class DailyQuestionCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatchService: DailyQuestionDispatchService,
  ) {}

  async listCampaigns() {
    const [schedules, runs, tenants] = await Promise.all([
      this.prisma.dailyQuestionSchedule.findMany({
        where: { campaignKey: { not: null } },
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          question: { include: { topicRef: true } },
        },
        orderBy: [
          { campaignKey: 'asc' },
          { campaignDay: 'asc' },
          { createdAt: 'asc' },
        ],
      }),
      this.prisma.dailyQuestionCampaignRun.findMany({
        orderBy: { startedAt: 'desc' },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.tenant.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, appAccessEnabled: true },
      }),
    ]);

    const groups = new Map<string, any>();

    for (const schedule of schedules) {
      const campaignKey = schedule.campaignKey;
      if (!campaignKey) continue;

      if (!groups.has(campaignKey)) {
        groups.set(campaignKey, {
          campaignKey,
          name: schedule.name ?? campaignKey,
          maxDay: 1,
          questionCount: 0,
          activeScheduleCount: 0,
          schedules: [],
          runs: [],
        });
      }

      const group = groups.get(campaignKey);
      group.maxDay = Math.max(group.maxDay, schedule.campaignDay ?? 1);
      group.questionCount += 1;
      if (schedule.isActive) group.activeScheduleCount += 1;
      group.schedules.push(schedule);
    }

    for (const run of runs) {
      const group = groups.get(run.campaignKey);
      if (!group) continue;
      group.runs.push({
        id: run.id,
        status: run.status,
        tenant: run.tenant,
        startedAt: run.startedAt,
        endedAt: run.endedAt,
        lastProcessedDay: run.lastProcessedDay,
        lastProcessedAt: run.lastProcessedAt,
      });
    }

    return {
      tenants,
      campaigns: [...groups.values()],
    };
  }

  async updateScheduleDay(
    scheduleId: string,
    input: { campaignDay?: number; isActive?: boolean },
  ) {
    const schedule = await this.prisma.dailyQuestionSchedule.findUnique({
      where: { id: scheduleId },
      select: { id: true },
    });

    if (!schedule) {
      throw new NotFoundException('A kampány ütemezés nem található.');
    }

    const data: any = {};
    if (input.campaignDay !== undefined) {
      const day = Number(input.campaignDay);
      if (!Number.isInteger(day) || day < 1) {
        throw new BadRequestException('A kampány napja legalább 1 legyen.');
      }
      data.campaignDay = day;
    }
    if (input.isActive !== undefined) {
      data.isActive = !!input.isActive;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nincs módosítandó adat.');
    }

    return this.prisma.dailyQuestionSchedule.update({
      where: { id: scheduleId },
      data,
      include: { question: true },
    });
  }

  async startCampaign(input: {
    tenantId: string;
    campaignKey: string;
    triggeredByUserId?: string | null;
  }) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) throw new NotFoundException('Tenant nem található.');

    const campaignKey = input.campaignKey?.trim();
    if (!campaignKey)
      throw new BadRequestException('Kampány azonosító kötelező.');

    const activeRun = await this.prisma.dailyQuestionCampaignRun.findFirst({
      where: { tenantId: tenant.id, campaignKey, status: 'active' },
    });
    if (activeRun) {
      throw new BadRequestException(
        'Ez a kampány már aktív ennél a tenantnál.',
      );
    }

    const run = await this.prisma.dailyQuestionCampaignRun.create({
      data: {
        tenantId: tenant.id,
        campaignKey,
        status: 'active',
      },
    });

    const result = await this.processRunDay(
      run.id,
      1,
      input.triggeredByUserId ?? null,
    );

    return {
      run,
      tenant,
      day: 1,
      ...result,
    };
  }

  async processDueCampaigns(now = new Date()) {
    const runs = await this.prisma.dailyQuestionCampaignRun.findMany({
      where: { status: 'active' },
    });

    const results: any[] = [];
    for (const run of runs) {
      const day = this.getCampaignDay(run.startedAt, now);
      if (run.lastProcessedDay && run.lastProcessedDay >= day) continue;
      results.push(await this.processRunDay(run.id, day, null));
    }

    return results;
  }

  private async processRunDay(
    runId: string,
    campaignDay: number,
    triggeredByUserId?: string | null,
  ) {
    const run = await this.prisma.dailyQuestionCampaignRun.findUnique({
      where: { id: runId },
    });
    if (!run) throw new NotFoundException('Kampány futás nem található.');

    const maxSchedule = await this.prisma.dailyQuestionSchedule.aggregate({
      where: {
        campaignKey: run.campaignKey,
        isActive: true,
        OR: [{ tenantId: run.tenantId }, { tenantId: null }],
      },
      _max: { campaignDay: true },
    });

    const maxDay = maxSchedule._max.campaignDay ?? 0;
    if (maxDay > 0 && campaignDay > maxDay) {
      await this.prisma.dailyQuestionCampaignRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          endedAt: new Date(),
          lastProcessedDay: run.lastProcessedDay,
          lastProcessedAt: new Date(),
        },
      });
      return { status: 'completed', dispatched: 0, recipients: 0 };
    }

    const schedules = await this.prisma.dailyQuestionSchedule.findMany({
      where: {
        campaignKey: run.campaignKey,
        campaignDay,
        isActive: true,
        OR: [{ tenantId: run.tenantId }, { tenantId: null }],
      },
      orderBy: { createdAt: 'asc' },
    });

    const dispatchResults: any[] = [];
    for (const schedule of schedules) {
      dispatchResults.push(
        await this.dispatchService.triggerScheduleForTenant({
          tenantId: run.tenantId,
          scheduleId: schedule.id,
          sentOn: new Date(),
          triggeredByUserId,
        }),
      );
    }

    await this.prisma.dailyQuestionCampaignRun.update({
      where: { id: run.id },
      data: {
        lastProcessedDay: campaignDay,
        lastProcessedAt: new Date(),
      },
    });

    return {
      status: 'processed',
      campaignKey: run.campaignKey,
      tenantId: run.tenantId,
      day: campaignDay,
      dispatched: dispatchResults.length,
      recipients: dispatchResults.reduce(
        (sum, item) => sum + item.recipients,
        0,
      ),
      dispatchResults,
    };
  }

  private getCampaignDay(startedAt: Date, now: Date) {
    const start = this.dateKeyToUtcDay(this.getBudapestDateKey(startedAt));
    const current = this.dateKeyToUtcDay(this.getBudapestDateKey(now));
    return Math.max(
      1,
      Math.floor((current.getTime() - start.getTime()) / 86400000) + 1,
    );
  }

  private getBudapestDateKey(date: Date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Budapest',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }

  private dateKeyToUtcDay(key: string) {
    const [year, month, day] = key.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }
}
