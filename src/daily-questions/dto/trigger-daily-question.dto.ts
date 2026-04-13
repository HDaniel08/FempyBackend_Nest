import { IsDateString, IsOptional, IsString } from 'class-validator';

export class TriggerDailyQuestionDto {
  @IsOptional()
  @IsDateString()
  sentOn?: string;

  @IsOptional()
  @IsString()
  triggeredByUserId?: string;
}