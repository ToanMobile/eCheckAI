import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyncQueueItem, SyncStatus, SyncEventType } from './sync-queue.entity';
import { AttendanceService } from '../attendance/attendance.service';
import { AutoCheckinDto } from '../attendance/dto/auto-checkin.dto';

export interface SyncBatchItem {
  event_type: SyncEventType;
  payload: Record<string, unknown>;
  client_timestamp: string;
}

export interface SyncBatchResult {
  processed: number;
  failed: number;
  results: Array<{
    event_type: string;
    success: boolean;
    error?: string;
    attendance_record_id?: string;
  }>;
}

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectRepository(SyncQueueItem)
    private readonly syncQueueRepository: Repository<SyncQueueItem>,
    private readonly attendanceService: AttendanceService,
  ) {}

  /**
   * Process a batch of offline sync items
   */
  async batchSync(
    employeeId: string,
    items: SyncBatchItem[],
    clientIp: string,
  ): Promise<SyncBatchResult> {
    const results: SyncBatchResult['results'] = [];
    let processed = 0;
    let failed = 0;

    // Sort by client_timestamp to process in chronological order
    const sorted = [...items].sort(
      (a, b) =>
        new Date(a.client_timestamp).getTime() -
        new Date(b.client_timestamp).getTime(),
    );

    for (const item of sorted) {
      const queueItem = this.syncQueueRepository.create({
        employeeId,
        eventType: item.event_type,
        payload: item.payload,
        status: SyncStatus.PROCESSING,
      });
      await this.syncQueueRepository.save(queueItem);

      try {
        let attendanceRecordId: string | undefined;

        if (
          item.event_type === SyncEventType.AUTO_CHECKIN ||
          item.event_type === SyncEventType.MANUAL_CHECKIN
        ) {
          const dto = item.payload as unknown as AutoCheckinDto;
          const result = await this.attendanceService.autoCheckin(dto, clientIp);
          void result; // result is returned but we just need success flag
        } else if (item.event_type === SyncEventType.AUTO_CHECKOUT) {
          const dto = item.payload as unknown as AutoCheckinDto;
          await this.attendanceService.autoCheckout(dto, clientIp);
        }

        await this.syncQueueRepository.update(queueItem.id, {
          status: SyncStatus.COMPLETED,
          processedAt: new Date(),
          attendanceRecordId: attendanceRecordId ?? null,
        });

        results.push({
          event_type: item.event_type,
          success: true,
          attendance_record_id: attendanceRecordId,
        });
        processed++;
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        await this.syncQueueRepository
          .createQueryBuilder()
          .update()
          .set({
            status: SyncStatus.FAILED,
            errorMessage,
            retryCount: () => '"retry_count" + 1',
          })
          .where('id = :id', { id: queueItem.id })
          .execute();

        results.push({
          event_type: item.event_type,
          success: false,
          error: errorMessage,
        });
        failed++;
        this.logger.warn(
          `Sync item failed for employee ${employeeId}: ${errorMessage}`,
        );
      }
    }

    return { processed, failed, results };
  }

  /**
   * Check sync queue status for an employee
   */
  async getSyncStatus(employeeId: string): Promise<{
    pending: number;
    failed: number;
    completed: number;
  }> {
    const [pending, failed, completed] = await Promise.all([
      this.syncQueueRepository.count({
        where: { employeeId, status: SyncStatus.PENDING },
      }),
      this.syncQueueRepository.count({
        where: { employeeId, status: SyncStatus.FAILED },
      }),
      this.syncQueueRepository.count({
        where: { employeeId, status: SyncStatus.COMPLETED },
      }),
    ]);

    return { pending, failed, completed };
  }
}
