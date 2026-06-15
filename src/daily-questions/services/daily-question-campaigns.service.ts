import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DailyQuestionDispatchService } from './daily-question-dispatch.service';
import { WorkScheduleService } from '../../work-schedule/work-schedule.service';

@Injectable()
export class DailyQuestionCampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatchService: DailyQuestionDispatchService,
    private readonly workSchedule: WorkScheduleService,
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

    const workStatus = await this.workSchedule.getStatus(tenant.id);
    const result = workStatus.allowed
      ? await this.processRunDay(
          run.id,
          1,
          input.triggeredByUserId ?? null,
          new Date(),
        )
      : {
          status: 'waiting_for_work_time',
          dispatched: 0,
          recipients: 0,
          nextRunAt: workStatus.nextStart,
        };

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
      const workStatus = await this.workSchedule.getStatus(run.tenantId, now);
      if (!workStatus.allowed) continue;

      if (
        run.lastProcessedAt &&
        this.getDateKey(run.lastProcessedAt, workStatus.timeZone) ===
          workStatus.dateKey
      ) {
        continue;
      }

      const day = (run.lastProcessedDay ?? 0) + 1;
      results.push(await this.processRunDay(run.id, day, null, now));
    }

    return results;
  }

  private async processRunDay(
    runId: string,
    campaignDay: number,
    triggeredByUserId?: string | null,
    now = new Date(),
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
          sentOn: now,
          triggeredByUserId,
        }),
      );
    }

    await this.prisma.dailyQuestionCampaignRun.update({
      where: { id: run.id },
      data: {
        lastProcessedDay: campaignDay,
        lastProcessedAt: now,
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

  private getDateKey(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  }
}
