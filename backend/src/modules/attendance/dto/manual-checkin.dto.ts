import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';

export class ManualCheckinDto {
  @IsUUID()
  employee_id!: string;

  @IsISO8601({ strict: true })
  timestamp!: string;

  @IsString()
  @IsOptional()
  @Length(1, 500)
  note?: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  device_id!: string;
}
