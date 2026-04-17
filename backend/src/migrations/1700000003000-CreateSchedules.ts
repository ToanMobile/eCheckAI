import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSchedules1700000003000 implements MigrationInterface {
  name = 'CreateSchedules1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id       UUID NOT NULL REFERENCES branches(id),
        name            VARCHAR(255) NOT NULL,
        checkin_time    TIME NOT NULL,
        checkout_time   TIME NOT NULL,
        window_minutes  INTEGER NOT NULL DEFAULT 15,
        active_days     INTEGER[] NOT NULL DEFAULT '{1,2,3,4,5}',
        is_active       BOOLEAN NOT NULL DEFAULT true,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schedules_branch_id
        ON schedules (branch_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_schedules_branch_active
        ON schedules (branch_id, is_active)
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_schedules_updated_at
        BEFORE UPDATE ON schedules
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_schedules_updated_at ON schedules`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS schedules CASCADE`);
  }
}
