import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { WorkScheduleService } from '../work-schedule/work-schedule.service';
import { DailyReminderService } from './daily-reminder.service';

describe('DailyReminderService', () => {
  let service: DailyReminderService;
  let prisma: any;
  let notifications: { sendNow: jest.Mock };
  let workSchedule: { getStatus: jest.Mock };

  const workStatus = {
    allowed: true,
    reason: 'within_work',
    timeZone: 'Europe/Budapest',
    dateKey: '2026-06-15',
    startAt: new Date('2026-06-15T06:00:00.000Z'),
    endAt: new Date('2026-06-15T14:00:00.000Z'),
    nextStart: new Date('2026-06-15T06:00:00.000Z'),
  };

  beforeEach(async () => {
    prisma = {
      tenant: { findMany: jest.fn().mockResolvedValue([]) },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]),
      },
      dailyMood: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }]),
      },
      dailyQuestionnaireAnswer: {
        groupBy: jest.fn().mockResolvedValue([
          { userId: 'user-2', _count: { _all: 3 } },
        ]),
      },
    };
    notifications = {
      sendNow: jest
        .fn()
        .mockResolvedValue({ id: 'notification-1', deduplicated: false }),
    };
    workSchedule = {
      getStatus: jest.fn().mockResolvedValue(workStatus),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DailyReminderService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notifications },
        { provide: WorkScheduleService, useValue: workSchedule },
      ],
    }).compile();

    service = module.get(DailyReminderService);
  });

  it('does not send reminders before the fourth work hour', async () => {
    const result = await service.processTenant(
      'tenant-1',
      new Date('2026-06-15T09:59:00.000Z'),
    );

    expect(result).toEqual({
      tenantId: 'tenant-1',
      moodQueued: 0,
      questionQueued: 0,
    });
    expect(notifications.sendNow).not.toHaveBeenCalled();
  });

  it('reminds only users without a daily mood after four hours', async () => {
    const result = await service.processTenant(
      'tenant-1',
      new Date('2026-06-15T10:00:00.000Z'),
    );

    expect(result.moodQueued).toBe(1);
    expect(result.questionQueued).toBe(0);
    expect(notifications.sendNow).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        type: 'daily_mood_reminder',
        dedupeKey:
          'tenant-1:daily_mood_reminder:2026-06-15:user-2',
      }),
    );
  });

  it('sends one questionnaire reminder for users with pending answers', async () => {
    const result = await service.processTenant(
      'tenant-1',
      new Date('2026-06-15T12:00:00.000Z'),
    );

    expect(result.questionQueued).toBe(1);
    expect(notifications.sendNow).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-2',
        type: 'daily_question_reminder',
        dedupeKey:
          'tenant-1:daily_question_reminder:2026-06-15:user-2',
        payload: expect.objectContaining({
          body: expect.stringContaining('3 megválaszolatlan kérdésed'),
        }),
      }),
    );
  });

  it('does nothing outside the configured work period', async () => {
    workSchedule.getStatus.mockResolvedValue({
      allowed: false,
      reason: 'rest_day',
      timeZone: 'Europe/Budapest',
      dateKey: '2026-06-20',
      nextStart: new Date('2026-06-22T06:00:00.000Z'),
    });

    await service.processTenant(
      'tenant-1',
      new Date('2026-06-20T10:00:00.000Z'),
    );

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(notifications.sendNow).not.toHaveBeenCalled();
  });
});
