import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ArrayMinSize,
} from 'class-validator';
import { DailyQuestionType } from '@prisma/client';

export class CreateDailyQuestionDto {
  @IsOptional()
  @IsString()
  topicId?: string;

  @IsString()
  topic: string;

  @IsString()
  question: string;

  @IsEnum(DailyQuestionType)
  type: DailyQuestionType;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  answerOptions: string[];

  @IsOptional()
  @IsBoolean()
  isGlobal?: boolean;

  @IsOptional()
  @IsString()
  hungarianNorm?: string;

  @IsOptional()
  @IsString()
  hungarianStd?: string;
}
