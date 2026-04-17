import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  Min,
} from 'class-validator';

export class CreateScheduleDto {
  @IsUUID()
  branch_id!: string;

  @IsString()
  @IsOptional()
  @Length(1, 255)
  shift_name?: string;

  /**
   * HH:MM format (e.g. "08:00")
   */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'checkin_time must be in HH:MM format',
  })
  checkin_time!: string;

  /**
   * HH:MM format (e.g. "17:30")
   */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'checkout_time must be in HH:MM format',
  })
  checkout_time!: string;

  /**
   * +/- tolerance window in minutes
   */
  @IsInt()
  @IsOptional()
  @Min(0)
  @Max(120)
  window_minutes?: number;

  /**
   * ISO day numbers: 1=Mon, 2=Tue, ..., 7=Sun
   */
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
