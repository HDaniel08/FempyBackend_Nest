import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SubmitDailyQuestionAnswerDto } from '../dto/submit-daily-question-answer.dto';

@Injectable()
export class DailyQuestionAnswerService {
  constructor(private readonly prisma: PrismaService) {}

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

    return this.prisma.dailyQuestionnaireAnswer.update({
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
  }
}