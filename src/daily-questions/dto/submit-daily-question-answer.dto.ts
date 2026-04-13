import { IsString } from 'class-validator';

export class SubmitDailyQuestionAnswerDto {
  @IsString()
  answerId: string;

  @IsString()
  answer: string;
}