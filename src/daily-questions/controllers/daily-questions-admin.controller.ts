import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { DailyQuestionsService } from '../services/daily-questions.service';
import { DailyQuestionSchedulesService } from '../services/daily-question-schedules.service';
import { DailyQuestionDispatchService } from '../services/daily-question-dispatch.service';
import { CreateDailyQuestionDto } from '../dto/create-daily-question.dto';
import { UpdateDailyQuestionDto } from '../dto/update-daily-question.dto';
import { CreateDailyQuestionScheduleDto } from '../dto/create-daily-question-schedule.dto';
import { UpdateDailyQuestionScheduleDto } from '../dto/update-daily-question-schedule.dto';
import { TriggerDailyQuestionDto } from '../dto/trigger-daily-question.dto';

@Controller('daily-questions/admin')
export class DailyQuestionsAdminController {
  constructor(
    private readonly dailyQuestionsService: DailyQuestionsService,
    private readonly schedulesService: DailyQuestionSchedulesService,
    private readonly dispatchService: DailyQuestionDispatchService,
  ) {}

  @Post('questions')
  createQuestion(@Req() req: any, @Body() dto: CreateDailyQuestionDto) {
    return this.dailyQuestionsService.create(req.user, dto);
  }

  @Get('questions')
  listQuestions(@Req() req: any) {
    return this.dailyQuestionsService.list(req.user);
  }

  @Patch('questions/:id')
  updateQuestion(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDailyQuestionDto,
  ) {
    return this.dailyQuestionsService.update(req.user, id, dto);
  }

  @Post('questions/:id/toggle')
  toggleQuestion(@Req() req: any, @Param('id') id: string) {
    return this.dailyQuestionsService.toggle(req.user, id);
  }

  @Post('schedules')
  createSchedule(@Req() req: any, @Body() dto: CreateDailyQuestionScheduleDto) {
    return this.schedulesService.create(req.user, dto);
  }

  @Get('schedules')
  listSchedules(@Req() req: any) {
    return this.schedulesService.list(req.user);
  }

  @Patch('schedules/:id')
  updateSchedule(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateDailyQuestionScheduleDto,
  ) {
    return this.schedulesService.update(req.user, id, dto);
  }

  @Post('schedules/:id/toggle')
  toggleSchedule(@Req() req: any, @Param('id') id: string) {
    return this.schedulesService.toggle(req.user, id);
  }

  @Post('schedules/:id/trigger')
  triggerSchedule(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: TriggerDailyQuestionDto,
  ) {
    return this.dispatchService.triggerSchedule(req.user, id, dto);
  }
}