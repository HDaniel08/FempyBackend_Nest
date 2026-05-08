import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SESSION_TIMEOUT_SECONDS = 120;
const MAX_HEARTBEAT_SECONDS = 90;

@Injectable()
export class UsageService {
  constructor(private readonly prisma: PrismaService) {}

  async heartbeat(
    userCtx: any,
    input: { sessionId?: string; platform?: string; appVersion?: string },
  ) {
    const { tenantId, userId } = this.getCtxIds(userCtx);
    const now = new Date();
    const staleBefore = new Date(now.getTime() - SESSION_TIMEOUT_SECONDS * 1000);

    if (input.sessionId) {
      const session = await this.prisma.appUsageSession.findFirst({
        where: {
          id: input.sessionId,
          tenantId,
          userId,
          status: 'active',
        },
      });

      if (session && session.lastSeenAt >= staleBefore) {
        return this.touchSession(session, now);
      }

      if (session) {
        await this.closeSession(session.id, session.lastSeenAt);
      }
    }

    const active = await this.prisma.appUsageSession.findFirst({
      where: {
        tenantId,
        userId,
        status: 'active',
        lastSeenAt: { gte: staleBefore },
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (active) return this.touchSession(active, now);

    return this.prisma.appUsageSession.create({
      data: {
        tenantId,
        userId,
        startedAt: now,
        lastSeenAt: now,
        platform: input.platform ?? null,
        appVersion: input.appVersion ?? null,
        heartbeatCount: 1,
      },
    });
  }

  async end(userCtx: any, input: { sessionId?: string }) {
    const { tenantId, userId } = this.getCtxIds(userCtx);
    const session = await this.prisma.appUsageSession.findFirst({
      where: {
        ...(input.sessionId ? { id: input.sessionId } : {}),
        tenantId,
        userId,
        status: 'active',
      },
      orderBy: { lastSeenAt: 'desc' },
    });

    if (!session) return { ok: true };
    return this.closeSession(session.id, new Date());
  }

  async getTenantSummary(tenantId: string, days = 7) {
    const safeDays = Math.min(Math.max(Number(days) || 7, 1), 90);
    const since = this.daysAgo(safeDays - 1);

    const sessions = await this.prisma.appUsageSession.findMany({
      where: { tenantId, startedAt: { gte: since } },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            isDeleted: true,
          },
        },
      },
      orderBy: { startedAt: 'desc' },
    });

    const activeUsers = new Set(sessions.map((session) => session.userId));
    const totalSeconds = sessions.reduce((sum, session) => sum + session.durationSeconds, 0);
    const rankingMap = new Map<string, any>();

    for (const session of sessions) {
      const current = rankingMap.get(session.userId) ?? {
        user: session.user,
        totalSeconds: 0,
        sessions: 0,
        lastSeenAt: session.lastSeenAt,
        averageSessionSeconds: 0,
      };
      current.totalSeconds += session.durationSeconds;
      current.sessions += 1;
      if (session.lastSeenAt > current.lastSeenAt) current.lastSeenAt = session.lastSeenAt;
      rankingMap.set(session.userId, current);
    }

    const ranking = [...rankingMap.values()]
      .map((item) => ({
        ...item,
        averageSessionSeconds: item.sessions
          ? Math.round(item.totalSeconds / item.sessions)
          : 0,
      }))
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, 20);

    return {
      range: { days: safeDays, since },
      summary: {
        totalSeconds,
        totalSessions: sessions.length,
        activeUsers: activeUsers.size,
        averagePerUserSeconds: activeUsers.size
          ? Math.round(totalSeconds / activeUsers.size)
          : 0,
        averageSessionSeconds: sessions.length
          ? Math.round(totalSeconds / sessions.length)
          : 0,
      },
      daily: this.reduceDaily(sessions, safeDays),
      ranking,
    };
  }

  private async touchSession(session: any, now: Date) {
    const deltaSeconds = Math.max(
      0,
      Math.min(
        MAX_HEARTBEAT_SECONDS,
        Math.round((now.getTime() - session.lastSeenAt.getTime()) / 1000),
      ),
    );

    return this.prisma.appUsageSession.update({
      where: { id: session.id },
      data: {
        lastSeenAt: now,
        durationSeconds: { increment: deltaSeconds },
        heartbeatCount: { increment: 1 },
      },
    });
  }

  private closeSession(sessionId: string, endedAt: Date) {
    return this.prisma.appUsageSession.update({
      where: { id: sessionId },
      data: {
        endedAt,
        status: 'ended',
      },
    });
  }

  private reduceDaily(sessions: any[], days: number) {
    const map = new Map<string, any>();
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = this.daysAgo(i).toISOString().slice(0, 10);
      map.set(date, { date, totalSeconds: 0, sessions: 0, users: 0 });
    }

    const usersByDate = new Map<string, Set<string>>();
    for (const session of sessions) {
      const date = session.startedAt.toISOString().slice(0, 10);
      const row = map.get(date);
      if (!row) continue;
      row.totalSeconds += session.durationSeconds;
      row.sessions += 1;
      if (!usersByDate.has(date)) usersByDate.set(date, new Set());
      usersByDate.get(date)?.add(session.userId);
    }

    for (const [date, users] of usersByDate.entries()) {
      const row = map.get(date);
      if (row) row.users = users.size;
    }

    return [...map.values()];
  }

  private daysAgo(days: number) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private getCtxIds(userCtx: any) {
    const tenantId = userCtx?.tenantId;
    const userId = userCtx?.sub ?? userCtx?.id ?? userCtx?.userId;
    if (!tenantId || !userId) {
      throw new BadRequestException('Missing tenant or user context.');
    }
    return { tenantId, userId };
  }
}
