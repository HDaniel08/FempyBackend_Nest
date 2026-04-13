import { PartialType } from '@nestjs/mapped-types';
import { CreateDailyQuestionDto } from './create-daily-question.dto';

export class UpdateDailyQuestionDto extends PartialType(CreateDailyQuestionDto) {}