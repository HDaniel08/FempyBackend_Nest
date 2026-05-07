import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DailyQuestionTopicReportService {
  constructor(private readonly prisma: PrismaService) {}

  private getCtxIds(userCtx: any) {
    const tenantId = userCtx?.tenantId ?? null;
    const userId = userCtx?.sub ?? userCtx?.id ?? userCtx?.userId ?? null;

    if (!tenantId || !userId) {
      throw new BadRequestException('Hiányzó tenant vagy user context.');
    }

    return { tenantId, userId };
  }

  async listCompletedReports(userCtx: any) {
    const { tenantId, userId } = this.getCtxIds(userCtx);

    const answers = await this.prisma.dailyQuestionnaireAnswer.findMany({
      where: {
        tenantId,
        userId,
        filledAt: { not: null },
      },
      include: {
        question: { include: { topicRef: true } },
        dispatch: { include: { schedule: true } },
      },
      orderBy: [{ sentOn: 'desc' }, { createdAt: 'desc' }],
    });

    const grouped = this.groupAnswers(answers as any[]);
    const reports: any[] = [];

    for (const group of grouped.values()) {
      const scheduleQuestions = await this.findCampaignScheduleQuestionIds(
        tenantId,
        group,
      );
      const filledQuestionIds = new Set(group.answers.map((a) => a.questionId));

      const isComplete =
        scheduleQuestions.length > 0 &&
        scheduleQuestions.every((questionId) => filledQuestionIds.has(questionId));

      if (!isComplete) continue;

      reports.push(await this.buildReport(tenantId, group, scheduleQuestions));
    }

    return {
      items: reports.sort((a, b) => {
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      }),
    };
  }

  private groupAnswers(answers: any[]) {
    const groups = new Map<string, any>();

    for (const answer of answers) {
      const question = answer.question;
      if (!question) continue;

      const topicId = question.topicId ?? `legacy:${question.topic}`;
      const campaignKey =
        answer.dispatch?.campaignKey ??
        answer.dispatch?.schedule?.campaignKey;

      if (!campaignKey) continue;

      const key = `${topicId}::${campaignKey}`;

      if (!groups.has(key)) {
        groups.set(key, {
          id: key,
          topicId: question.topicId,
          topicName: question.topicRef?.name ?? question.topic,
          campaignKey,
          answers: [],
          scheduleIds: new Set<string>(),
        });
      }

      const group = groups.get(key);
      group.answers.push(answer);

      const scheduleId = answer.dispatch?.scheduleId;
      if (scheduleId) group.scheduleIds.add(scheduleId);
    }

    return groups;
  }

  private async findCampaignScheduleQuestionIds(
    tenantId: string,
    group: any,
  ): Promise<string[]> {
    if (!group.campaignKey || String(group.campaignKey).length === 0) {
      return [...new Set<string>(group.answers.map((a) => a.questionId))];
    }

    const schedules = await this.prisma.dailyQuestionSchedule.findMany({
      where: {
        OR: [{ tenantId }, { tenantId: null }],
        campaignKey: group.campaignKey,
        question: group.topicId
          ? { topicId: group.topicId }
          : { topic: group.topicName },
      },
      select: { questionId: true },
    });

    const questionIds = schedules.map((schedule) => schedule.questionId);

    return questionIds.length
      ? [...new Set<string>(questionIds)]
      : [...new Set<string>(group.answers.map((a) => a.questionId))];
  }

  private async buildReport(
    tenantId: string,
    group: any,
    scheduleQuestionIds: string[],
  ) {
    const answersByQuestion = new Map<string, any>(
      group.answers.map((answer) => [answer.questionId, answer]),
    );

    const tenantAnswers = await this.prisma.dailyQuestionnaireAnswer.findMany({
      where: {
        tenantId,
        questionId: { in: scheduleQuestionIds },
        filledAt: { not: null },
        dispatch: {
          campaignKey: group.campaignKey,
        },
      },
      include: {
        question: { include: { topicRef: true } },
      },
    });

    const tenantAverageByQuestion = new Map<string, number>();

    for (const questionId of scheduleQuestionIds) {
      const numericAnswers = tenantAnswers
        .filter((answer) => answer.questionId === questionId)
        .map((answer) => this.toAnswerScore(answer))
        .filter((value): value is number => Number.isFinite(value));

      const avg = numericAnswers.length
        ? numericAnswers.reduce((sum, value) => sum + value, 0) /
          numericAnswers.length
        : null;

      if (avg !== null) tenantAverageByQuestion.set(questionId, avg);
    }

    const periodDates = group.answers.map((answer) => new Date(answer.sentOn));
    const filledDates = group.answers
      .map((answer) => answer.filledAt)
      .filter(Boolean)
      .map((date) => new Date(date));

    const questions = scheduleQuestionIds
      .map((questionId) => answersByQuestion.get(questionId))
      .filter(Boolean)
      .map((answer) => {
        const questionId = answer.questionId;
        const question = answer.question;

        return {
          questionId,
          question: question.question,
          topicId: question.topicId,
          topicName: question.topicRef?.name ?? question.topic,
          sentOn: this.toIsoDate(answer.sentOn),
          filledAt: answer.filledAt?.toISOString() ?? null,
          userValue: this.toAnswerScore(answer),
          tenantAverage: this.round(tenantAverageByQuestion.get(questionId)),
          hungarianNorm: this.toNumber(question.hungarianNorm),
          hungarianStd: this.toNumber(question.hungarianStd),
        };
      });

    const userAverage = this.average(
      questions
        .map((q) => q.userValue)
        .filter((value): value is number => Number.isFinite(value)),
    );
    const tenantAverage = this.average(
      questions
        .map((q) => q.tenantAverage)
        .filter((value) => value !== null) as number[],
    );

    return {
      id: this.makeReportId(group.topicId ?? group.topicName, group.campaignKey),
      topicId: group.topicId,
      topicName: group.topicName,
      campaignKey: group.campaignKey,
      periodStart: this.toIsoDate(new Date(Math.min(...periodDates.map(Number)))),
      periodEnd: this.toIsoDate(new Date(Math.max(...periodDates.map(Number)))),
      completedAt: new Date(Math.max(...filledDates.map(Number))).toISOString(),
      questionCount: questions.length,
      userAverage: this.round(userAverage),
      tenantAverage: this.round(tenantAverage),
      insight: this.buildInsight(userAverage, tenantAverage),
      questions,
    };
  }

  private makeReportId(topicId: string, campaignKey: string) {
    return Buffer.from(`${topicId}::${campaignKey}`).toString('base64url');
  }

  private average(values: number[]) {
    const numeric = values.filter((value) => Number.isFinite(value));
    if (!numeric.length) return null;

    return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
  }

  private round(value: number | null | undefined) {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return null;
    }

    return Math.round(value * 10) / 10;
  }

  private toNumber(value: unknown) {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }

  private toAnswerScore(answer: any) {
    const numeric = Number(answer.answer);
    if (Number.isFinite(numeric)) return numeric;

    const options = answer.question?.answerOptions;
    if (!Array.isArray(options)) return null;

    const optionIndex = options.findIndex((option) => option === answer.answer);
    if (optionIndex < 0) return null;

    return options.length - optionIndex;
  }

  private toIsoDate(value: Date | string) {
    return new Date(value).toISOString().slice(0, 10);
  }

  private buildInsight(userAverage: number | null, tenantAverage: number | null) {
    if (userAverage === null || tenantAverage === null) {
      return 'A riport elkészült; az összehasonlító átlaghoz még kevés adat érkezett.';
    }

    const diff = userAverage - tenantAverage;

    if (Math.abs(diff) < 0.3) {
      return 'A válaszaid összességében közel vannak a céges átlaghoz.';
    }

    if (diff > 0) {
      return 'A válaszaid több ponton a céges átlag felett vannak.';
    }

    return 'A válaszaid több ponton a céges átlag alatt vannak.';
  }
}
