import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  IsIn,
} from "class-validator";
import { Type } from "class-transformer";

export class UpdateMyProfileDto {
  @IsOptional()
  @IsString()
  nickname?: string | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthday?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  gender?: number | null;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfStart?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsBoolean()
  onHoliday?: boolean;

  @IsOptional()
  @IsBoolean()
  lessNotification?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotification?: boolean;

  @IsOptional()
  @IsBoolean()
  dailyNotification?: boolean;

  // ✅ Preset avatar (1..7)
  @IsOptional()
  @IsString()
  @IsIn(["1", "2", "3", "4", "5", "6", "7"], {
    message: "profilePic must be one of: 1..7",
  })
  profilePic?: string;
}