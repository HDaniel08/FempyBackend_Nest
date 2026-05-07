import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { DailyQuestionAnswerService } from '../services/daily-question-answer.service';
import { SubmitDailyQuestionAnswerDto } from '../dto/submit-daily-question-answer.dto';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { DailyQuestionTopicReportService } from '../services/daily-question-topic-report.service';

@UseGuards(JwtAuthGuard)
@Controller('daily-questions/me')
export class DailyQuestionsUserController {
  constructor(
    private readonly answerService: DailyQuestionAnswerService,
    private readonly topicReportService: DailyQuestionTopicReportService,
  ) {}

  @Get('pending')
  getPending(@Req() req: any) {
 
    return this.answerService.getPending(req.user);
  }

  @Get('history')
  getHistory(@Req() req: any) {
   
    return this.answerService.getHistory(req.user);
  }

  @Get('topic-reports')
  getTopicReports(@Req() req: any) {
    return this.topicReportService.listCompletedReports(req.user);
  }

  @Post('submit')
  submit(@Req() req: any, @Body() dto: SubmitDailyQuestionAnswerDto) {

    return this.answerService.submit(req.user, dto);
  }
}
