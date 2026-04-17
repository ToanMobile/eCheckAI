import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 150)
  name!: string;

  @IsString()
  @IsOptional()
  @Length(0, 255)
  address?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsNumber()
  @Min(10)
  @Max(5000)
  @IsOptional()
  radius_meters?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  wifi_bssids?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  wifi_ssids?: string[];

  @IsString()
  @IsOptional()
  @Length(1, 50)
  timezone?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
