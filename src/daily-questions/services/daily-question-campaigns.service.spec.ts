import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkScheduleService } from '../../work-schedule/work-schedule.service';
import { DailyQuestionCampaignsService } from './daily-question-campaigns.service';
import { DailyQuestionDispatchService } from './daily-question-dispatch.service';

describe('DailyQuestionCampaignsService', () => {
  let service: DailyQuestionCampaignsService;
  let prisma: any;
  let dispatchService: { triggerScheduleForTenant: jest.Mock };
  let workSchedule: { getStatus: jest.Mock };

  beforeEach(async () => {
    prisma = {
      dailyQuestionCampaignRun: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      dailyQuestionSchedule: {
        aggregate: jest.fn().mockResolvedValue({ _max: { campaignDay: 3 } }),
        findMany: jest.fn().mockResolvedValue([{ id: 'schedule-1' }]),
      },
    };
    dispatchService = {
      triggerScheduleForTenant: jest.fn().mockResolvedValue({
        recipients: 4,
      }),
    };
    workSchedule = {
      getStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyQuestionCampaignsService,
        { provide: PrismaService, useValue: prisma },
        { provide: DailyQuestionDispatchService, useValue: dispatchService },
        { provide: WorkScheduleService, useValue: workSchedule },
      ],
    }).compile();

    service = module.get(DailyQuestionCampaignsService);
  });

  it('does not process campaigns outside work time', async () => {
    prisma.dailyQuestionCampaignRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        tenantId: 'tenant-1',
        lastProcessedDay: 1,
        lastProcessedAt: null,
      },
    ]);
    workSchedule.getStatus.mockResolvedValue({
      allowed: false,
      timeZone: 'Europe/Budapest',
      dateKey: '2026-06-20',
      nextStart: new Date('2026-06-22T06:00:00.000Z'),
    });

    const result = await service.processDueCampaigns(
      new Date('2026-06-20T08:00:00.000Z'),
    );

    expect(result).toEqual([]);
    expect(dispatchService.triggerScheduleForTenant).not.toHaveBeenCalled();
  });

  it('does not process the same campaign twice on one work day', async () => {
    prisma.dailyQuestionCampaignRun.findMany.mockResolvedValue([
      {
        id: 'run-1',
        tenantId: 'tenant-1',
        lastProcessedDay: 2,
        lastProcessedAt: new Date('2026-06-15T07:00:00.000Z'),
      },
    ]);
    workSchedule.getStatus.mockResolvedValue({
      allowed: true,
      timeZone: 'Europe/Budapest',
      dateKey: '2026-06-15',
      nextStart: new Date('2026-06-15T08:00:00.000Z'),
    });

    const result = await service.processDueCampaigns(
      new Date('2026-06-15T10:00:00.000Z'),
    );

    expect(result).toEqual([]);
    expect(dispatchService.triggerScheduleForTenant).not.toHaveBeenCalled();
  });

  it('increments the campaign by one on the next eligible work day', async () => {
    const run = {
      id: 'run-1',
      tenantId: 'tenant-1',
      campaignKey: 'campaign-1',
      lastProcessedDay: 2,
      lastProcessedAt: new Date('2026-06-15T07:00:00.000Z'),
    };
    prisma.dailyQuestionCampaignRun.findMany.mockResolvedValue([run]);
    prisma.dailyQuestionCampaignRun.findUnique.mockResolvedValue(run);
    workSchedule.getStatus.mockResolvedValue({
      allowed: true,
      timeZone: 'Europe/Budapest',
      dateKey: '2026-06-16',
      nextStart: new Date('2026-06-16T08:00:00.000Z'),
    });
    const now = new Date('2026-06-16T10:00:00.000Z');

    await service.processDueCampaigns(now);

    expect(dispatchService.triggerScheduleForTenant).toHaveBeenCalledWith({
      tenantId: 'tenant-1',
      scheduleId: 'schedule-1',
      sentOn: now,
      triggeredByUserId: null,
    });
    expect(prisma.dailyQuestionCampaignRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: {
        lastProcessedDay: 3,
        lastProcessedAt: now,
      },
    });
  });
});
