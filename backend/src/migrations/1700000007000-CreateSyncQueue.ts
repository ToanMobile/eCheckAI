import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSyncQueue1700000007000 implements MigrationInterface {
  name = 'CreateSyncQueue1700000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id      UUID        NOT NULL REFERENCES employees(id),
        idempotency_key  VARCHAR(64) UNIQUE NOT NULL,
        type             VARCHAR(20) NOT NULL,
        payload          JSONB       NOT NULL,
        status           VARCHAR(20) NOT NULL DEFAULT 'pending',
        retry_count      INTEGER     NOT NULL DEFAULT 0,
        last_error       TEXT,
        synced_at        TIMESTAMPTZ,
        attendance_id    UUID, -- intentionally no FK (partitioned table)
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_employee_id
        ON sync_queue (employee_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status
        ON sync_queue (status)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_sync_queue_pending
        ON sync_queue (created_at)
        WHERE status = 'pending'
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_sync_queue_updated_at
        BEFORE UPDATE ON sync_queue
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_sync_queue_updated_at ON sync_queue`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS sync_queue CASCADE`);
  }
}
