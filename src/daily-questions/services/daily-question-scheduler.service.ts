import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DailyQuestionCampaignsService } from './daily-question-campaigns.service';

@Injectable()
export class DailyQuestionSchedulerService {
  private readonly logger = new Logger(DailyQuestionSchedulerService.name);

  constructor(
    private readonly campaignsService: DailyQuestionCampaignsService,
  ) {}

  @Cron('0 9 * * *', { timeZone: 'Europe/Budapest' })
  async handleDailyCampaigns() {
    const results = await this.campaignsService.processDueCampaigns();
    if (results.length > 0) {
      this.logger.log(
        `Napi kérdőív kampány feldolgozás: ${results.length} futás`,
      );
    }
  }
}
