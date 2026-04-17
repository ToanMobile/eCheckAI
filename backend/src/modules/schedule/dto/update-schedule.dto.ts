import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class UpdateScheduleDto {
  @IsString()
  @IsOptional()
  @Length(1, 255)
  shift_name?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'checkin_time must be in HH:MM format',
  })
  checkin_time?: string;

  @IsString()
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'checkout_time must be in HH:MM format',
  })
  checkout_time?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(120)
  window_minutes?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(1, { each: true })
  @Max(7, { each: true })
  @IsOptional()
  active_days?: number[];

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
