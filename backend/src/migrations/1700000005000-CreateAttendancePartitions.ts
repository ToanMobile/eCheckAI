import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttendancePartitions1700000005000
  implements MigrationInterface
{
  name = 'CreateAttendancePartitions1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const now = new Date();

    // Create 13 monthly partitions starting from the current month
    for (let i = 0; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');

      const nextD = new Date(d.getFullYear(), d.getMonth() + 1, 1);
      const nextYear = nextD.getFullYear();
      const nextMonth = String(nextD.getMonth() + 1).padStart(2, '0');

      const tableName = `attendance_records_${year}_${month}`;
      const fromDate = `${year}-${month}-01`;
      const toDate = `${nextYear}-${nextMonth}-01`;

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "${tableName}"
          PARTITION OF attendance_records
          FOR VALUES FROM ('${fromDate}') TO ('${toDate}')
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const now = new Date();

    for (let i = 0; i < 13; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const tableName = `attendance_records_${year}_${month}`;

      await queryRunner.query(
        `DROP TABLE IF EXISTS "${tableName}"`,
      );
    }
  }
}
