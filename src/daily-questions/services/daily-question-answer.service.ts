import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitDailyQuestionAnswerDto } from '../dto/submit-daily-question-answer.dto';
import { ActivityLogService } from '../../activity/activity-log.service';

@Injectable()
export class DailyQuestionAnswerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityLogService,
  ) {}

  private getCtxIds(userCtx: any) {
    const tenantId = userCtx?.tenantId ?? null;
    const userId = userCtx?.sub ?? userCtx?.id ?? userCtx?.userId ?? null;

    if (!tenantId || !userId) {
      throw new BadRequestException('Hiányzó tenant vagy user context.');
    }

    return { tenantId, userId };
  }

  async getPending(userCtx: any) {
    const { tenantId, userId } = this.getCtxIds(userCtx);

    return this.prisma.dailyQuestionnaireAnswer.findMany({
      where: {
        tenantId,
        userId,
        isActive: true,
        filledAt: null,
      },
      include: {
        question: true,
        dispatch: true,
      },
      orderBy: [{ sentOn: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getHistory(userCtx: any) {
    const { tenantId, userId } = this.getCtxIds(userCtx);

    return this.prisma.dailyQuestionnaireAnswer.findMany({
      where: {
        tenantId,
        userId,
        filledAt: { not: null },
      },
      include: {
        question: true,
        dispatch: true,
      },
      orderBy: [{ filledAt: 'desc' }],
      take: 50,
    });
  }

  async submit(userCtx: any, dto: SubmitDailyQuestionAnswerDto) {
    const { tenantId, userId } = this.getCtxIds(userCtx);

    const answerRecord = await this.prisma.dailyQuestionnaireAnswer.findFirst({
      where: {
        id: dto.answerId,
        tenantId,
        userId,
      },
      include: {
        question: true,
        dispatch: { include: { schedule: true } },
      },
    });

    if (!answerRecord) {
      throw new NotFoundException('A kérdőív példány nem található.');
    }

    if (answerRecord.filledAt) {
      throw new BadRequestException('Ez a kérdőív már ki lett töltve.');
    }

    const options = Array.isArray(answerRecord.question.answerOptions)
      ? answerRecord.question.answerOptions
      : [];

    if (!options.includes(dto.answer)) {
      throw new BadRequestException('Érvénytelen válaszopció.');
    }

    const campaignPatch = await this.resolveDispatchCampaignPatch(
      tenantId,
      answerRecord,
    );

    const updated = await this.prisma.$transaction(async (tx) => {
      if (campaignPatch) {
        await tx.dailyQuestionDispatch.update({
          where: { id: answerRecord.dispatchId },
          data: campaignPatch,
        });
      }

      return tx.dailyQuestionnaireAnswer.update({
        where: { id: dto.answerId },
        data: {
          answer: dto.answer,
          filledAt: new Date(),
        },
        include: {
          question: true,
          dispatch: true,
        },
      });
    });

    await this.activity.log({
      tenantId,
      userId,
      event: 'DAILY_QUESTION_ANSWER_SUBMITTED',
      source: 'app',
      entityType: 'DAILY_QUESTION_ANSWER',
      entityId: updated.id,
      metadata: {
        questionId: updated.questionId,
        dispatchId: updated.dispatchId,
        campaignKey: updated.dispatch?.campaignKey ?? null,
        sentOn: updated.sentOn,
      },
    });

    return updated;
  }

  private async resolveDispatchCampaignPatch(tenantId: string, answerRecord: any) {
    const dispatch = answerRecord.dispatch;

    if (!dispatch || dispatch.campaignKey) return null;

    if (dispatch.schedule?.campaignKey) {
      return {
        campaignKey: dispatch.schedule.campaignKey,
      };
    }

    const schedule = await this.prisma.dailyQuestionSchedule.findFirst({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        questionId: answerRecord.questionId,
        campaignKey: { not: null },
        isActive: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!schedule?.campaignKey) return null;

    return {
      scheduleId: schedule.id,
      campaignKey: schedule.campaignKey,
    };
  }
}
