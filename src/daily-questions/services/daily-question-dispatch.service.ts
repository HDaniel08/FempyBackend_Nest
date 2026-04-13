import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TriggerDailyQuestionDto } from '../dto/trigger-daily-question.dto';
import { DailyQuestionAudienceService } from './daily-question-audience.service';
import { DailyQuestionPushService } from './daily-question-push.service';

@Injectable()
export class DailyQuestionDispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audienceService: DailyQuestionAudienceService,
    private readonly pushService: DailyQuestionPushService,
  ) {}

  private getCtxIds(userCtx: any) {
    const tenantId = userCtx?.tenantId ?? null;
    const userId = userCtx?.sub ?? userCtx?.id ?? userCtx?.userId ?? null;
    return { tenantId, userId };
  }

  async triggerSchedule(userCtx: any, scheduleId: string, dto: TriggerDailyQuestionDto) {
    const { tenantId, userId } = this.getCtxIds(userCtx);

    if (!tenantId) {
      throw new BadRequestException('A manual trigger tenant környezetet igényel.');
    }

    const schedule = await this.prisma.dailyQuestionSchedule.findFirst({
      where: {
        id: scheduleId,
        OR: [{ tenantId }, { tenantId: null }],
        isActive: true,
      },
      include: {
        question: true,
      },
    });

    if (!schedule) {
      throw new NotFoundException('Az aktív schedule nem található.');
    }

    const targetUsers = await this.audienceService.resolveUsers({
      tenantId,
      audienceType: schedule.audienceType,
      audienceConfig: schedule.audienceConfig,
    });

    const sentOn = dto.sentOn ? new Date(dto.sentOn) : this.startOfDay(new Date());

    const pushPayload = {
      title:
        schedule.pushTitle ||
        this.pushService.buildDefaultPush(schedule.question.topic).title,
      body:
        schedule.pushBody ||
        this.pushService.buildDefaultPush(schedule.question.topic).body,
    };

    const dispatch = await this.prisma.dailyQuestionDispatch.create({
  data: {
    tenantId,
    questionId: schedule.questionId,
    scheduleId: schedule.id,
    triggeredByUserId: dto.triggeredByUserId || userId,
    sentOn,
    sentAt: new Date(),
    audienceType: schedule.audienceType,
    audienceConfig:
      schedule.audienceConfig === null || schedule.audienceConfig === undefined
        ? undefined
        : (schedule.audienceConfig as any),
    pushTitle: pushPayload.title,
    pushBody: pushPayload.body,
    pushSent: false,
  },
});

    if (targetUsers.length > 0) {
      await this.prisma.dailyQuestionnaireAnswer.createMany({
        data: targetUsers.map((user) => ({
          tenantId: user.tenantId,
          userId: user.id,
          questionId: schedule.questionId,
          dispatchId: dispatch.id,
          sentOn,
          isActive: true,
        })),
        skipDuplicates: true,
      });
    }

    let pushResult: any = null;

    try {
      pushResult = await this.pushService.sendToUsers(
        targetUsers.map((u) => u.id),
        pushPayload,
      );

      await this.prisma.dailyQuestionDispatch.update({
        where: { id: dispatch.id },
        data: { pushSent: true },
      });
    } catch (error) {
      pushResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Push küldési hiba',
      };
    }

    await this.prisma.dailyQuestionSchedule.update({
      where: { id: schedule.id },
      data: { lastTriggeredAt: new Date() },
    });

    return {
      dispatch,
      recipients: targetUsers.length,
      pushResult,
    };
  }

  private startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }
}