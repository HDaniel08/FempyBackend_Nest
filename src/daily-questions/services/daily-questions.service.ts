import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDailyQuestionDto } from '../dto/create-daily-question.dto';
import { UpdateDailyQuestionDto } from '../dto/update-daily-question.dto';

@Injectable()
export class DailyQuestionsService {
  constructor(private readonly prisma: PrismaService) {}

  private getCtxIds(userCtx: any) {
    const tenantId = userCtx?.tenantId ?? null;
    const userId = userCtx?.sub ?? userCtx?.id ?? userCtx?.userId ?? null;
    return { tenantId, userId };
  }

  async create(userCtx: any, dto: CreateDailyQuestionDto) {
    const { tenantId } = this.getCtxIds(userCtx);

    if (!dto.isGlobal && !tenantId) {
      throw new BadRequestException('Tenant-specifikus kérdéshez tenantId szükséges.');
    }

    return this.prisma.dailyQuestion.create({
      data: {
        tenantId: dto.isGlobal ? null : tenantId,
        topic: dto.topic,
        question: dto.question,
        type: dto.type,
        answerOptions: dto.answerOptions,
        isGlobal: dto.isGlobal ?? false,
        isActive: true,
        hungarianNorm: dto.hungarianNorm ? dto.hungarianNorm : undefined,
        hungarianStd: dto.hungarianStd ? dto.hungarianStd : undefined,
      },
    });
  }

  async list(userCtx: any) {
    const { tenantId } = this.getCtxIds(userCtx);

    return this.prisma.dailyQuestion.findMany({
      where: {
        OR: [
          { tenantId },
          { isGlobal: true },
        ],
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async update(userCtx: any, id: string, dto: UpdateDailyQuestionDto) {
    const { tenantId } = this.getCtxIds(userCtx);

    const question = await this.prisma.dailyQuestion.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { isGlobal: true }],
      },
    });

    if (!question) {
      throw new NotFoundException('A kérdés nem található.');
    }

    return this.prisma.dailyQuestion.update({
      where: { id },
      data: {
        topic: dto.topic,
        question: dto.question,
        type: dto.type,
        answerOptions: dto.answerOptions,
        isGlobal: dto.isGlobal,
        hungarianNorm: dto.hungarianNorm,
        hungarianStd: dto.hungarianStd,
      },
    });
  }

  async toggle(userCtx: any, id: string) {
    const { tenantId } = this.getCtxIds(userCtx);

    const question = await this.prisma.dailyQuestion.findFirst({
      where: {
        id,
        OR: [{ tenantId }, { isGlobal: true }],
      },
    });

    if (!question) {
      throw new NotFoundException('A kérdés nem található.');
    }

    return this.prisma.dailyQuestion.update({
      where: { id },
      data: {
        isActive: !question.isActive,
      },
    });
  }
}