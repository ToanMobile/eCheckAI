import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { IsArray, IsEnum, IsNotEmpty, IsObject, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SyncService, SyncBatchItem } from './sync.service';
import { SyncEventType } from './sync-queue.entity';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../config/jwt.config';

class SyncBatchItemDto implements SyncBatchItem {
  @IsEnum(SyncEventType)
  event_type!: SyncEventType;

  @IsObject()
  payload!: Record<string, unknown>;

  @IsString()
  @IsNotEmpty()
  client_timestamp!: string;
}

class SyncBatchDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SyncBatchItemDto)
  items!: SyncBatchItemDto[];
}

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Post('batch')
  @HttpCode(HttpStatus.OK)
  async batchSync(
    @Body() dto: SyncBatchDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const ip =
      (req.headers['x-forwarded-for'] as string) ?? req.ip ?? 'unknown';
    return this.syncService.batchSync(user.sub, dto.items, ip);
  }

  @Get('status')
  async getStatus(@CurrentUser() user: JwtPayload) {
    return this.syncService.getSyncStatus(user.sub);
  }
}
