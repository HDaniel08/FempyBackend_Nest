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

  private makeSlug(value: string) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'topic';
  }

  private async resolveTopic(input: {
    tenantId: string | null;
    topicId?: string;
    topic: string;
    isGlobal?: boolean;
  }) {
    if (input.topicId) {
      const topic = await this.prisma.dailyQuestionTopic.findFirst({
        where: {
          id: input.topicId,
          OR: [{ tenantId: input.tenantId }, { isGlobal: true }],
        },
      });

      if (!topic) {
        throw new NotFoundException('A témakör nem található.');
      }

      return topic;
    }

    const name = input.topic.trim();
    const tenantId = input.isGlobal ? null : input.tenantId;

    const existing = await this.prisma.dailyQuestionTopic.findFirst({
      where: {
        tenantId,
        name,
      },
    });

    if (existing) return existing;

    const baseSlug = this.makeSlug(name);
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    return this.prisma.dailyQuestionTopic.create({
      data: {
        tenantId,
        name,
        slug,
        isGlobal: input.isGlobal ?? false,
      },
    });
  }

  async create(userCtx: any, dto: CreateDailyQuestionDto) {
    const { tenantId } = this.getCtxIds(userCtx);

    if (!dto.isGlobal && !tenantId) {
      throw new BadRequestException('Tenant-specifikus kérdéshez tenantId szükséges.');
    }

    const isGlobal = dto.isGlobal ?? false;
    const topic = await this.resolveTopic({
      tenantId,
      topicId: dto.topicId,
      topic: dto.topic,
      isGlobal,
    });

    return this.prisma.dailyQuestion.create({
      data: {
        tenantId: isGlobal ? null : tenantId,
        topicId: topic.id,
        topic: topic.name,
        question: dto.question,
        type: dto.type,
        answerOptions: dto.answerOptions,
        isGlobal,
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
      include: { topicRef: true },
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

    let topicData = {};

    if (dto.topic || dto.topicId) {
      const topic = await this.resolveTopic({
        tenantId,
        topicId: dto.topicId,
        topic: dto.topic ?? question.topic,
        isGlobal: dto.isGlobal ?? question.isGlobal,
      });

      topicData = {
        topicId: topic.id,
        topic: topic.name,
      };
    }

    return this.prisma.dailyQuestion.update({
      where: { id },
      data: {
        ...topicData,
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
