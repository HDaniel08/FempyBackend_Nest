import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GetDailyMoodHistoryDto, UpsertDailyMoodDto } from "./dto/upsert-daily-mood.dto";
import { UpdateDailyMoodCommentDto } from "./dto/update-daily-mood-comment.dto";

/**
 * Napi kedv szabály:
 * - 1 user / 1 nap / 1 tenant => 1 rekord (unique index)
 * - komment csak akkor adható, ha van már napi kedv rekord
 */
@Injectable()
export class DailyMoodService {
  constructor(private prisma: PrismaService) {}

private getCtxIds(userCtx: any) {
 
  const tenantId = userCtx?.tenantId;
  const userId = userCtx?.sub ?? userCtx?.id ?? userCtx?.userId;

  if (!tenantId || typeof tenantId !== "string") {
    throw new BadRequestException("Missing tenantId in request context");
  }
  if (!userId || typeof userId !== "string") {
    throw new BadRequestException("Missing userId in request context");
  }

  return { tenantId, userId };
}


  // "Mai nap" kezelése: egyszerűen a szerver napját használjuk (date-only)
  private todayDateOnly() {
    const d = new Date();
    // date-only: 00:00:00 (fontos: ugyanazt a logikát használd mindenhol)
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
   private parseDateOnly(value: string, fieldName: string) {
    const match = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!match) {
      throw new BadRequestException(`${fieldName} must be in YYYY-MM-DD format`);
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${fieldName} is not a valid date`);
    }

    return date;
  }

  private formatDateOnly(date: Date) {
    return date.toISOString().slice(0, 10);
  }

  private addUtcDays(date: Date, days: number) {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result;
  }


  async getToday(userCtx: any) {
    const { tenantId, userId } = this.getCtxIds(userCtx);
    const date = this.todayDateOnly();

    return this.prisma.dailyMood.findUnique({
      where: {
        tenantId_userId_date: { tenantId, userId, date },
      },
    });
  }
  async getHistory(userCtx: any, query: GetDailyMoodHistoryDto) {
    const { tenantId, userId } = this.getCtxIds(userCtx);

    let fromDate: Date;
    let toDate: Date;

    if (query.from || query.to) {
      if (!query.from || !query.to) {
        throw new BadRequestException("Both from and to must be provided together");
      }

      fromDate = this.parseDateOnly(query.from, "from");
      toDate = this.parseDateOnly(query.to, "to");
    } else {
      const days = query.days ?? 5;
      if (days < 1 || days > 365) {
        throw new BadRequestException("days must be between 1 and 365");
      }

      toDate = this.todayDateOnly();
      fromDate = this.addUtcDays(toDate, -(days - 1));
    }

    if (fromDate > toDate) {
      throw new BadRequestException("from cannot be later than to");
    }

    const diffInDays =
      Math.floor((toDate.getTime() - fromDate.getTime()) / 86400000) + 1;

    if (diffInDays > 365) {
      throw new BadRequestException("Maximum query range is 365 days");
    }

    const rows = await this.prisma.dailyMood.findMany({
      where: {
        tenantId,
        userId,
        date: {
          gte: fromDate,
          lte: toDate,
        },
      },
      orderBy: {
        date: "asc",
      },
      select: {
        date: true,
        mood: true,
        comment: true,
      },
    });

    const rowMap = new Map(
      rows.map((row) => [this.formatDateOnly(row.date), row])
    );

    const items: { date: string; mood: number | null; comment: string | null }[] = [];

    let cursor = new Date(fromDate);

    while (cursor <= toDate) {
      const key = this.formatDateOnly(cursor);
      const row = rowMap.get(key);

      items.push({
        date: key,
        mood: row?.mood ?? null,
        comment: row?.comment ?? null,
      });

      cursor = this.addUtcDays(cursor, 1);
    }

    return {
      range: {
        from: this.formatDateOnly(fromDate),
        to: this.formatDateOnly(toDate),
      },
      items,
    };
  }

  async upsertToday(userCtx: any, dto: UpsertDailyMoodDto) {

    const { tenantId, userId } = this.getCtxIds(userCtx);
    const date = this.todayDateOnly();

    return this.prisma.dailyMood.upsert({
      where: {
        tenantId_userId_date: { tenantId, userId, date },
      },
      update: {
        mood: dto.mood,
        // ha comment is jön, felülírjuk, ha nem jön, békén hagyjuk:
        ...(dto.comment !== undefined ? { comment: dto.comment } : {}),
      },
      create: {
        tenant: { connect: { id: tenantId } },
        user: { connect: { id: userId } },
        date,
        mood: dto.mood,
        comment: dto.comment ?? null,
      },
    });
  }

  async updateTodayComment(userCtx: any, dto: UpdateDailyMoodCommentDto) {
    const { tenantId, userId } = this.getCtxIds(userCtx);
    const date = this.todayDateOnly();

    const existing = await this.prisma.dailyMood.findUnique({
      where: { tenantId_userId_date: { tenantId, userId, date } },
      select: { id: true },
    });

    if (!existing) {
      // csak akkor lehet kommentelni, ha már van napi kedv
      throw new BadRequestException("Nincs még rögzített napi kedv ehhez a naphoz.");
    }

    return this.prisma.dailyMood.update({
      where: { id: existing.id },
      data: { comment: dto.comment },
    });
  }
}