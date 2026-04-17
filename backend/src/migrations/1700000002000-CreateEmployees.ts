import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEmployees1700000002000 implements MigrationInterface {
  name = 'CreateEmployees1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE employee_role AS ENUM (
        'employee',
        'branch_manager',
        'hr',
        'super_admin'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id             UUID NOT NULL REFERENCES branches(id),
        employee_code         VARCHAR(50)  UNIQUE NOT NULL,
        full_name             VARCHAR(255) NOT NULL,
        email                 VARCHAR(255) UNIQUE NOT NULL,
        phone                 VARCHAR(20),
        password_hash         VARCHAR(255) NOT NULL,
        role                  employee_role NOT NULL DEFAULT 'employee',
        registered_device_id  VARCHAR(255),
        device_registered_at  TIMESTAMPTZ,
        refresh_token_hash    VARCHAR(255),
        refresh_token_expires TIMESTAMPTZ,
        is_active             BOOLEAN NOT NULL DEFAULT true,
        last_login_at         TIMESTAMPTZ,
        deleted_at            TIMESTAMPTZ,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_branch_id
        ON employees (branch_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_email
        ON employees (email)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_employee_code
        ON employees (employee_code)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_employees_role
        ON employees (role)
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_employees_updated_at
        BEFORE UPDATE ON employees
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS update_employees_updated_at ON employees`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS employees CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS employee_role`);
  }
}
