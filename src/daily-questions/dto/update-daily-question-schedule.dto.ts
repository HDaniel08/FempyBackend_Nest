import { PartialType } from '@nestjs/mapped-types';
import { CreateDailyQuestionScheduleDto } from './create-daily-question-schedule.dto';

export class UpdateDailyQuestionScheduleDto extends PartialType(
  CreateDailyQuestionScheduleDto,
) {}