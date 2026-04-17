import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * PartitionManagerService
 *
 * Runs once a month (20th at 00:01) to pre-create the next month's
 * attendance_records partition so no records are ever rejected at
 * month boundary.
 *
 * Cron: '1 0 20 * *'  ->  00:01 on the 20th of every month
 */
@Injectable()
export class PartitionManagerService {
  private readonly logger = new Logger(PartitionManagerService.name);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Called automatically by @nestjs/schedule on the 20th of each month.
   * Also exposed as a public method so it can be called manually
   * (e.g. from an admin endpoint or integration test).
   */
  @Cron('1 0 20 * *', { name: 'create-next-month-partition' })
  async createNextMonthPartition(): Promise<void> {
    const now = new Date();
    // Target = next calendar month
    const target = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    await this.ensurePartitionExists(target);
  }

  /**
   * Creates the partition for `targetMonth` if it does not already exist.
   * `targetMonth` must be a Date whose year/month identify the partition;
   * the day component is ignored.
   */
  async ensurePartitionExists(targetMonth: Date): Promise<void> {
    const year = targetMonth.getFullYear();
    const month = String(targetMonth.getMonth() + 1).padStart(2, '0');

    const nextMonth = new Date(
      targetMonth.getFullYear(),
      targetMonth.getMonth() + 1,
      1,
    );
    const nextYear = nextMonth.getFullYear();
    const nextMonthStr = String(nextMonth.getMonth() + 1).padStart(2, '0');

    const tableName = `attendance_records_${year}_${month}`;
    const fromDate = `${year}-${month}-01`;
    const toDate = `${nextYear}-${nextMonthStr}-01`;

    try {
      await this.dataSource.query(`
        CREATE TABLE IF NOT EXISTS "${tableName}"
          PARTITION OF attendance_records
          FOR VALUES FROM ('${fromDate}') TO ('${toDate}')
      `);

      this.logger.log(
        `Partition "${tableName}" ensured (${fromDate} -> ${toDate})`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to create partition "${tableName}": ${message}`,
      );
      throw err;
    }
  }

  /**
   * Convenience helper: ensures partitions exist for the current month
   * and the next N months ahead. Useful for bootstrapping or backfill.
   *
   * @param monthsAhead Number of future months to pre-create (default 2)
   */
  async ensureUpcomingPartitions(monthsAhead = 2): Promise<void> {
    const now = new Date();
    for (let i = 0; i <= monthsAhead; i++) {
      const target = new Date(now.getFullYear(), now.getMonth() + i, 1);
      await this.ensurePartitionExists(target);
    }
  }
}
