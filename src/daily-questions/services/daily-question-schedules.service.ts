import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDailyQuestionScheduleDto } from '../dto/create-daily-question-schedule.dto';
import { UpdateDailyQuestionScheduleDto } from '../dto/update-daily-question-schedule.dto';
import { DailyQuestionScheduleType } from '@prisma/client';

@Injectable()
export class DailyQuestionSchedulesService {
  constructor(private readonly prisma: PrismaService) {}

  private getCtxIds(userCtx: any) {
    const tenantId = userCtx?.tenantId ?? null;
    return { tenantId };
  }

  async create(userCtx: any, dto: CreateDailyQuestionScheduleDto) {
    const { tenantId } = this.getCtxIds(userCtx);

    const question = await this.prisma.dailyQuestion.findFirst({
      where: {
        id: dto.questionId,
        OR: [{ tenantId }, { isGlobal: true }],
      },
    });

    if (!question) {
      throw new NotFoundException('A kérdés nem található.');
    }

    if (
      dto.scheduleType === DailyQuestionScheduleType.ONE_TIME &&
      !dto.runAt
    ) {
      throw new BadRequestException('ONE_TIME schedule esetén runAt kötelező.');
    }

    if (
      dto.scheduleType === DailyQuestionScheduleType.CRON &&
      !dto.cronExpr
    ) {
      throw new BadRequestException('CRON schedule esetén cronExpr kötelező.');
    }

    return this.prisma.dailyQuestionSchedule.create({
      data: {
        tenantId: question.isGlobal ? null : tenantId,
        questionId: dto.questionId,
        name: dto.name,
        isActive: true,
        isDefaultWeekdayMorning: dto.isDefaultWeekdayMorning ?? false,
        scheduleType: dto.scheduleType,
        cronExpr: dto.cronExpr,
        runAt: dto.runAt ? new Date(dto.runAt) : null,
        audienceType: dto.audienceType ?? 'ALL',
        audienceConfig: dto.audienceConfig,
        pushTitle: dto.pushTitle,
        pushBody: dto.pushBody,
      },
      include: {
        question: true,
      },
    });
  }

  async list(userCtx: any) {
    const { tenantId } = this.getCtxIds(userCtx);

    return this.prisma.dailyQuestionSchedule.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
      },
      include: {
        question: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async update(userCtx: any, id: string, dto: UpdateDailyQuestionScheduleDto) {
    const { tenantId } = this.getCtxIds(userCtx);

    const schedule = await this.prisma.dailyQuestionSchedule.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { tenantId: null }],
      },
    });

    if (!schedule) {
      throw new NotFoundException('A schedule nem található.');
    }

    return this.prisma.dailyQuestionSchedule.update({
      where: { id },
      data: {
        name: dto.name,
        isDefaultWeekdayMorning: dto.isDefaultWeekdayMorning,
        scheduleType: dto.scheduleType,
        cronExpr: dto.cronExpr,
        runAt: dto.runAt ? new Date(dto.runAt) : undefined,
        audienceType: dto.audienceType,
        audienceConfig: dto.audienceConfig,
        pushTitle: dto.pushTitle,
        pushBody: dto.pushBody,
      },
      include: {
        question: true,
      },
    });
  }

  async toggle(userCtx: any, id: string) {
    const { tenantId } = this.getCtxIds(userCtx);

    const schedule = await this.prisma.dailyQuestionSchedule.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { tenantId: null }],
      },
    });

    if (!schedule) {
      throw new NotFoundException('A schedule nem található.');
    }

    return this.prisma.dailyQuestionSchedule.update({
      where: { id },
      data: { isActive: !schedule.isActive },
    });
  }
}