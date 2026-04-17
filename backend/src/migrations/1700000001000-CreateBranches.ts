import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBranches1700000001000 implements MigrationInterface {
  name = 'CreateBranches1700000001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pgcrypto is available for gen_random_uuid()
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS branches (
        id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name             VARCHAR(255) NOT NULL,
        code             VARCHAR(50)  UNIQUE NOT NULL,
        address          TEXT,
        latitude         DECIMAL(10, 8) NOT NULL,
        longitude        DECIMAL(11, 8) NOT NULL,
        radius_meters    INTEGER NOT NULL DEFAULT 100,
        wifi_bssids      JSONB NOT NULL DEFAULT '[]',
        wifi_ssids       JSONB NOT NULL DEFAULT '[]',
        timezone         VARCHAR(50) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
        telegram_chat_id VARCHAR(50),
        is_active        BOOLEAN NOT NULL DEFAULT true,
        deleted_at       TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_branches_code
        ON branches (code)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_branches_is_active
        ON branches (is_active)
        WHERE deleted_at IS NULL
    `);

    // Shared trigger function — idempotent so later migrations can also call it
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ language 'plpgsql'
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_branches_updated_at
        BEFORE UPDATE ON branches
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_branches_updated_at ON branches`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS branches CASCADE`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS update_updated_at_column CASCADE`,
    );
  }
}
