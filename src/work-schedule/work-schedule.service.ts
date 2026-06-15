import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

type WorkDay = {
  day: string;
  isRestDay: boolean;
  start: string | null;
  end: string | null;
};

@Injectable()
export class WorkScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(tenantId: string, now = new Date()) {
    const settings = await this.prisma.organizationSettings.findUnique({
      where: { tenantId },
      select: { workDays: true, timeZone: true },
    });

    const timeZone = settings?.timeZone || 'Europe/Budapest';
    const workDays = this.normalizeWorkDays(settings?.workDays);
    const local = this.getZonedParts(now, timeZone);
    const day = workDays.find((item) => item.day === local.dayKey);

    if (!day || day.isRestDay || !day.start || !day.end) {
      return {
        allowed: false,
        reason: 'rest_day' as const,
        timeZone,
        dateKey: local.dateKey,
        nextStart: this.findNextStart(now, timeZone, workDays),
      };
    }

    const currentMinutes = local.hour * 60 + local.minute;
    const startMinutes = this.timeToMinutes(day.start);
    const endMinutes = this.timeToMinutes(day.end);
    const startAt = this.localDateTimeToUtc(
      local.year,
      local.month,
      local.day,
      day.start,
      timeZone,
    );
    const endAt = this.localDateTimeToUtc(
      local.year,
      local.month,
      local.day,
      day.end,
      timeZone,
    );

    if (currentMinutes < startMinutes) {
      return {
        allowed: false,
        reason: 'before_work' as const,
        timeZone,
        dateKey: local.dateKey,
        startAt,
        endAt,
        nextStart: startAt,
      };
    }

    if (currentMinutes >= endMinutes) {
      return {
        allowed: false,
        reason: 'after_work' as const,
        timeZone,
        dateKey: local.dateKey,
        startAt,
        endAt,
        nextStart: this.findNextStart(now, timeZone, workDays),
      };
    }

    return {
      allowed: true,
      reason: 'within_work' as const,
      timeZone,
      dateKey: local.dateKey,
      startAt,
      endAt,
      nextStart: now,
    };
  }

  async nextAllowedAt(tenantId: string, requestedAt: Date) {
    const status = await this.getStatus(tenantId, requestedAt);
    return status.allowed ? requestedAt : status.nextStart;
  }

  private normalizeWorkDays(value: unknown): WorkDay[] {
    if (Array.isArray(value)) {
      const valid = value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === 'object' && !Array.isArray(item),
      );

      if (valid.length === 7) {
        return valid.map((item) => ({
          day: String(item.day),
          isRestDay: item.isRestDay === true,
          start: typeof item.start === 'string' ? item.start : null,
          end: typeof item.end === 'string' ? item.end : null,
        }));
      }
    }

    return DAY_KEYS.map((day, index) => ({
      day,
      isRestDay: index === 0 || index === 6,
      start: index === 0 || index === 6 ? null : '08:00',
      end: index === 0 || index === 6 ? null : '16:00',
    }));
  }

  private findNextStart(now: Date, timeZone: string, workDays: WorkDay[]) {
    const local = this.getZonedParts(now, timeZone);

    for (let offset = 0; offset <= 14; offset += 1) {
      const candidateDate = new Date(
        Date.UTC(local.year, local.month - 1, local.day + offset),
      );
      const year = candidateDate.getUTCFullYear();
      const month = candidateDate.getUTCMonth() + 1;
      const dayOfMonth = candidateDate.getUTCDate();
      const dayKey = DAY_KEYS[candidateDate.getUTCDay()];
      const workDay = workDays.find((item) => item.day === dayKey);

      if (!workDay || workDay.isRestDay || !workDay.start) continue;

      const candidate = this.localDateTimeToUtc(
        year,
        month,
        dayOfMonth,
        workDay.start,
        timeZone,
      );
      if (candidate.getTime() > now.getTime()) return candidate;
    }

    return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }

  private getZonedParts(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    }).formatToParts(date);
    const get = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value || '';
    const weekdayIndex: Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
    };
    const year = Number(get('year'));
    const month = Number(get('month'));
    const day = Number(get('day'));

    return {
      year,
      month,
      day,
      hour: Number(get('hour')),
      minute: Number(get('minute')),
      dayKey: DAY_KEYS[weekdayIndex[get('weekday')]],
      dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }

  private localDateTimeToUtc(
    year: number,
    month: number,
    day: number,
    time: string,
    timeZone: string,
  ) {
    const [hour, minute] = time.split(':').map(Number);
    const target = Date.UTC(year, month - 1, day, hour, minute);
    let guess = target;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const actual = this.getZonedParts(new Date(guess), timeZone);
      const actualAsUtc = Date.UTC(
        actual.year,
        actual.month - 1,
        actual.day,
        actual.hour,
        actual.minute,
      );
      guess += target - actualAsUtc;
    }

    return new Date(guess);
  }

  private timeToMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
