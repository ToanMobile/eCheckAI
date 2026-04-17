import {
  IsBoolean,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  Matches,
} from 'class-validator';

export class AutoCheckinDto {
  @IsUUID()
  employee_id!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, {
    message: 'wifi_bssid must be a valid MAC address',
  })
  wifi_bssid!: string;

  @IsString()
  @IsOptional()
  @Length(1, 100)
  wifi_ssid!: string | null;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsNumber()
  @Min(0)
  @Max(9999)
  gps_accuracy!: number;

  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  device_id!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 100)
  device_model!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 50)
  os_version!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  app_version!: string;

  @IsISO8601({ strict: true })
  timestamp!: string;

  @IsBoolean()
  is_vpn_active!: boolean;

  @IsBoolean()
  is_mock_location!: boolean;
}
