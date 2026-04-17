import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateFraudLogs1700000006000 implements MigrationInterface {
  name = 'CreateFraudLogs1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE fraud_type AS ENUM (
        'vpn_detected',
        'mock_location',
        'device_mismatch',
        'wifi_mismatch',
        'outside_geofence',
        'outside_schedule_window',
        'rate_limit_exceeded',
        'server_ip_vpn',
        'device_farming'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE fraud_severity AS ENUM (
        'low',
        'medium',
        'high',
        'critical'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS fraud_logs (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id      UUID NOT NULL REFERENCES employees(id),
        -- attendance_id has NO FK because attendance_records is a partitioned table
        attendance_id    UUID,
        fraud_type       fraud_type     NOT NULL,
        severity         fraud_severity NOT NULL DEFAULT 'medium',
        details          JSONB NOT NULL DEFAULT '{}',
        ip_address       VARCHAR(45),
        resolved_at      TIMESTAMPTZ,
        resolved_by      UUID REFERENCES employees(id),
        resolution_note  TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fraud_logs_employee_id
        ON fraud_logs (employee_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fraud_logs_fraud_type
        ON fraud_logs (fraud_type)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fraud_logs_severity
        ON fraud_logs (severity)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fraud_logs_created_at
        ON fraud_logs (created_at DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_fraud_logs_unresolved
        ON fraud_logs (resolved_at)
        WHERE resolved_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_fraud_logs_updated_at
        BEFORE UPDATE ON fraud_logs
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_fraud_logs_updated_at ON fraud_logs`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS fraud_logs CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS fraud_severity`);
    await queryRunner.query(`DROP TYPE IF EXISTS fraud_type`);
  }
}
