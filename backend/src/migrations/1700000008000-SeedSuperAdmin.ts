import { MigrationInterface, QueryRunner } from 'typeorm';
import * as bcrypt from 'bcrypt';

export class SeedSuperAdmin1700000008000 implements MigrationInterface {
  name = 'SeedSuperAdmin1700000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const adminEmail =
      process.env.SEED_ADMIN_EMAIL ?? 'admin@smartattendance.vn';
    const adminPassword =
      process.env.SEED_ADMIN_PASSWORD ?? 'SuperAdmin@2025!';
    const adminCode =
      process.env.SEED_ADMIN_CODE ?? 'ADMIN001';

    // ------------------------------------------------------------------
    // 1. Create a default HQ branch if no branches exist yet
    // ------------------------------------------------------------------
    const existingBranches = await queryRunner.query(
      `SELECT id FROM branches LIMIT 1`,
    );

    let branchId: string;

    if (existingBranches.length === 0) {
      const result: Array<{ id: string }> = await queryRunner.query(`
        INSERT INTO branches (
          name, code, address,
          latitude, longitude, radius_meters,
          wifi_bssids, wifi_ssids, timezone, is_active
        ) VALUES (
          'Head Quarter', 'HQ-001', 'Vietnam',
          10.7769, 106.7009, 100,
          '[]', '[]', 'Asia/Ho_Chi_Minh', true
        )
        ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `);
      branchId = result[0].id;
    } else {
      branchId = (existingBranches as Array<{ id: string }>)[0].id;
    }

    // ------------------------------------------------------------------
    // 2. Hash the password with bcrypt cost=12
    // ------------------------------------------------------------------
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // ------------------------------------------------------------------
    // 3. Insert super admin employee
    //    ON CONFLICT covers both the email and employee_code unique constraints.
    // ------------------------------------------------------------------
    await queryRunner.query(
      `
        INSERT INTO employees (
          branch_id, employee_code, full_name, email,
          password_hash, role, is_active
        ) VALUES (
          $1, $2, 'Super Administrator', $3,
          $4, 'super_admin', true
        )
        ON CONFLICT DO NOTHING
      `,
      [branchId, adminCode, adminEmail, passwordHash],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const adminEmail =
      process.env.SEED_ADMIN_EMAIL ?? 'admin@smartattendance.vn';

    await queryRunner.query(
      `DELETE FROM employees WHERE email = $1 AND role = 'super_admin'`,
      [adminEmail],
    );
  }
}
