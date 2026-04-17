import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { AttendanceStatus } from '../attendance.entity';

export class AttendanceQueryDto {
  @IsOptional()
  @IsUUID()
  branch_id?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  employee_id?: string;

  @IsOptional()
  @IsDateString()
  date_from?: string;

  @IsOptional()
  @IsDateString()
  date_to?: string;

  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 20;

  /** Alias for limit — sent by portal/mobile as per_page */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  per_page?: number;
}
