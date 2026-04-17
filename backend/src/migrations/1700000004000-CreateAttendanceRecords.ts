import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAttendanceRecords1700000004000 implements MigrationInterface {
  name = 'CreateAttendanceRecords1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE attendance_type AS ENUM (
        'auto_checkin',
        'auto_checkout',
        'manual'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE attendance_status AS ENUM (
        'on_time',
        'late',
        'early_leave',
        'absent',
        'pending'
      )
    `);

    // Partitioned by RANGE on work_date -- partitions created in migration 005
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS attendance_records (
        id                UUID    NOT NULL DEFAULT gen_random_uuid(),
        employee_id       UUID    NOT NULL REFERENCES employees(id),
        branch_id         UUID    NOT NULL REFERENCES branches(id),
        schedule_id       UUID    REFERENCES schedules(id),
        type              attendance_type   NOT NULL,
        status            attendance_status NOT NULL,
        check_in          TIMESTAMPTZ,
        check_out         TIMESTAMPTZ,
        work_date         DATE    NOT NULL,
        location_snapshot JSONB   NOT NULL DEFAULT '{}',
        device_snapshot   JSONB   NOT NULL DEFAULT '{}',
        note              TEXT,
        is_flagged        BOOLEAN NOT NULL DEFAULT false,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (id, work_date)
      ) PARTITION BY RANGE (work_date)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_employee_checkin
        ON attendance_records (employee_id, check_in DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_branch_workdate
        ON attendance_records (branch_id, work_date DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_workdate
        ON attendance_records (work_date DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_status
        ON attendance_records (status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_attendance_flagged
        ON attendance_records (is_flagged)
        WHERE is_flagged = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS attendance_records CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS attendance_status`);
    await queryRunner.query(`DROP TYPE IF EXISTS attendance_type`);
  }
}
