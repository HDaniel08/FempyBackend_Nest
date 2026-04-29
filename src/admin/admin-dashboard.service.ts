// src/admin/admin-dashboard.service.ts

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDaysAgo(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(
    tenantId: string,
    options?: {
      range?: number;
      positionId?: string | null;
    },
  ) {
    const range = options?.range ?? 7;

    if (![7, 14, 30].includes(range)) {
      throw new BadRequestException('Invalid range. Allowed values: 7, 14, 30.');
    }

    const positionId = options?.positionId ?? null;

    if (positionId) {
      const position = await this.prisma.position.findFirst({
        where: {
          id: positionId,
          tenantId,
          isDeleted: false,
        },
        select: { id: true },
      });

      if (!position) {
        throw new BadRequestException('Invalid positionId.');
      }
    }

    const today = startOfToday();
    const rangeStart = startOfDaysAgo(range - 1);

    const userWhere = {
      tenantId,
      isDeleted: false,
      ...(positionId ? { positionId } : {}),
    };

    const userIds = await this.prisma.user.findMany({
      where: userWhere,
      select: { id: true },
    });

    const scopedUserIds = userIds.map((u) => u.id);

    const moodWhere = {
      tenantId,
      date: {
        gte: rangeStart,
      },
      ...(positionId
        ? {
            userId: {
              in: scopedUserIds,
            },
          }
        : {}),
    };

    const todayMoodWhere = {
      tenantId,
      date: today,
      ...(positionId
        ? {
            userId: {
              in: scopedUserIds,
            },
          }
        : {}),
    };

    const [
      activeUsers,
      inactiveUsers,
      totalPositions,
      todayMoodCount,
      moodStats,
      moodTrendRaw,
      pendingQuestionAnswers,
      activeDailyQuestions,
    ] = await Promise.all([
      this.prisma.user.count({
        where: userWhere,
      }),

      this.prisma.user.count({
        where: {
          tenantId,
          isDeleted: true,
          ...(positionId ? { positionId } : {}),
        },
      }),

      this.prisma.position.count({
        where: {
          tenantId,
          isDeleted: false,
        },
      }),

      this.prisma.dailyMood.count({
        where: todayMoodWhere,
      }),

      this.prisma.dailyMood.aggregate({
        where: moodWhere,
        _avg: {
          mood: true,
        },
        _count: {
          mood: true,
        },
      }),

      this.prisma.dailyMood.groupBy({
        by: ['date'],
        where: moodWhere,
        _avg: {
          mood: true,
        },
        _count: {
          mood: true,
        },
        orderBy: {
          date: 'asc',
        },
      }),

      this.prisma.dailyQuestionnaireAnswer.count({
        where: {
          tenantId,
          filledAt: null,
          isActive: true,
          ...(positionId
            ? {
                userId: {
                  in: scopedUserIds,
                },
              }
            : {}),
        },
      }),

      this.prisma.dailyQuestion.count({
        where: {
          OR: [{ tenantId }, { tenantId: null, isGlobal: true }],
          isActive: true,
        },
      }),
    ]);

    const completionRate =
      activeUsers > 0 ? Math.round((todayMoodCount / activeUsers) * 100) : 0;

    const moodTrend = moodTrendRaw.map((item) => ({
      date: item.date.toISOString().slice(0, 10),
      value: item._avg.mood ? Number(item._avg.mood.toFixed(2)) : 0,
      answers: item._count.mood,
    }));

    return {
      filters: {
        range,
        positionId,
      },
      users: {
        active: activeUsers,
        inactive: inactiveUsers,
        total: activeUsers + inactiveUsers,
      },
      organization: {
        positions: totalPositions,
      },
      dailyMood: {
        todayAnswers: todayMoodCount,
        todayCompletionRate: completionRate,
        rangeAverage: moodStats._avg.mood
          ? Number(moodStats._avg.mood.toFixed(2))
          : null,
        rangeAnswers: moodStats._count.mood,
      },
      dailyQuestions: {
        pendingAnswers: pendingQuestionAnswers,
        activeQuestions: activeDailyQuestions,
      },
      moodTrend,
    };
  }
}