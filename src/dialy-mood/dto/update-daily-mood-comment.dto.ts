import { IsString, MaxLength } from "class-validator";

export class UpdateDailyMoodCommentDto {
  @IsString()
  @MaxLength(500)
  comment: string;
}