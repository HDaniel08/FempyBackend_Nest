import { Type } from "class-transformer";
import { IsInt, Max, Min, IsOptional, IsString, MaxLength } from "class-validator";

export class UpsertDailyMoodDto {
  @IsInt()
  @Min(1)
  @Max(5)
  mood: number;

  // Kommentet itt most nem kötelezően küldjük be, mert a UI külön modallal küldi majd
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;
}

export class GetDailyMoodHistoryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  days?: number;

  @IsOptional()
  @IsString()
  from?: string; // YYYY-MM-DD

  @IsOptional()
  @IsString()
  to?: string; // YYYY-MM-DD
}