import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { DailyQuestionAudienceType } from '@prisma/client';

@Injectable()
export class DailyQuestionAudienceService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveUsers(params: {
    tenantId: string;
    audienceType: DailyQuestionAudienceType | string;
    audienceConfig?: any;
  }) {
    const { tenantId, audienceType } = params;

    if (audienceType === DailyQuestionAudienceType.ALL || audienceType === 'ALL') {
      return this.prisma.user.findMany({
        where: {
          tenantId,
          // ide később jöhet pl. isActive: true
        },
        select: {
          id: true,
          tenantId: true,
        },
      });
    }

    return [];
  }
}