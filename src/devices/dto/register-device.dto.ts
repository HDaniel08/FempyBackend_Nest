import { IsObject, IsOptional, IsString, ValidateNested } from "class-validator";



export class RegisterDeviceDto {
  @IsString()
  expoToken: string;

  @IsOptional()
  @IsObject()
  deviceInfo?: Record<string, any>;
}