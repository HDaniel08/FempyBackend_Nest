import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  DailyQuestionAudienceType,
  DailyQuestionScheduleType,
} from '@prisma/client';

export class CreateDailyQuestionScheduleDto {
  @IsString()
  questionId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsEnum(DailyQuestionScheduleType)
  scheduleType: DailyQuestionScheduleType;

  @IsOptional()
  @IsString()
  cronExpr?: string;

  @IsOptional()
  @IsDateString()
  runAt?: string;

  @IsOptional()
  @IsEnum(DailyQuestionAudienceType)
  audienceType?: DailyQuestionAudienceType;

  @IsOptional()
  audienceConfig?: any;

  @IsOptional()
  @IsBoolean()
  isDefaultWeekdayMorning?: boolean;

  @IsOptional()
  @IsString()
  pushTitle?: string;

  @IsOptional()
  @IsString()
  pushBody?: string;
}