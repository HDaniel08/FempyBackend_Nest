import { IsString, MaxLength, MinLength } from "class-validator";

export class CreateGoalDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  text: string;
}