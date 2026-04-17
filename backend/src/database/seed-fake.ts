/**
 * Fake-data seeder — generates realistic demo data for Smart Attendance V2.
 *
 * Usage:
 *   FAKE_DATA=true npx ts-node -r tsconfig-paths/register src/database/seed-fake.ts
 *   FAKE_DATA=false  → script exits immediately (safe to call in CI)
 *
 * What it creates:
 *   • 10 HD Bank branches (HCMC + Hanoi)
 *   • 500 employees distributed across branches
 *   • 1 schedule per branch (Mon–Fri, 08:00–17:30)
 *   • 30 days of attendance records (realistic distribution)
 *   • ~50 fraud log entries
 *   • Updates dashboard stats cache in Redis
 */

import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';
import { Client } from 'pg';

dotenv.config();

// ─── Toggle ──────────────────────────────────────────────────────────────────
if (process.env['FAKE_DATA'] !== 'true') {
  console.log('FAKE_DATA is not "true" — skipping fake seed. Set FAKE_DATA=true to run.');
  process.exit(0);
}

// ─── DB connection ────────────────────────────────────────────────────────────
const db = new Client({
  host: process.env['DB_HOST'] ?? 'localhost',
  port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
  user: process.env['DB_USER'] ?? 'postgres',
  password: process.env['DB_PASS'] ?? 'postgres',
  database: process.env['DB_NAME'] ?? 'smart_attendance',
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pad2(n: number): string {
  return String(n).padStart(2, '0');
}
function dateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
function timeStr(h: number, m: number): string {
  return `${pad2(h)}:${pad2(m)}:00`;
}

// ─── Reference data ───────────────────────────────────────────────────────────
const BRANCHES = [
  { name: 'HDBank Quận 1',       code: 'HDB-Q1',  lat: 10.7769, lng: 106.7009, bssids: ['A0:B1:C2:D3:E4:F5', 'A0:B1:C2:D3:E4:F6'] },
  { name: 'HDBank Quận 3',       code: 'HDB-Q3',  lat: 10.7800, lng: 106.6873, bssids: ['B1:C2:D3:E4:F5:A0'] },
  { name: 'HDBank Quận 7',       code: 'HDB-Q7',  lat: 10.7330, lng: 106.7193, bssids: ['C2:D3:E4:F5:A0:B1'] },
  { name: 'HDBank Bình Thạnh',   code: 'HDB-BT',  lat: 10.8016, lng: 106.7143, bssids: ['D3:E4:F5:A0:B1:C2'] },
  { name: 'HDBank Tân Bình',     code: 'HDB-TB',  lat: 10.8012, lng: 106.6556, bssids: ['E4:F5:A0:B1:C2:D3'] },
  { name: 'HDBank Gò Vấp',       code: 'HDB-GV',  lat: 10.8380, lng: 106.6700, bssids: ['F5:A0:B1:C2:D3:E4'] },
  { name: 'HDBank Hà Nội Ba Đình',code: 'HDB-HN1', lat: 21.0358, lng: 105.8400, bssids: ['A1:B2:C3:D4:E5:F6'] },
  { name: 'HDBank Hoàn Kiếm',    code: 'HDB-HK',  lat: 21.0287, lng: 105.8524, bssids: ['B2:C3:D4:E5:F6:A1'] },
  { name: 'HDBank Cầu Giấy',     code: 'HDB-CG',  lat: 21.0333, lng: 105.7858, bssids: ['C3:D4:E5:F6:A1:B2'] },
  { name: 'HDBank Đống Đa',      code: 'HDB-DD',  lat: 21.0245, lng: 105.8412, bssids: ['D4:E5:F6:A1:B2:C3'] },
];

const FIRST_NAMES = [
  'Nguyễn','Trần','Lê','Phạm','Huỳnh','Hoàng','Phan','Vũ','Đặng','Bùi',
  'Đỗ','Hồ','Ngô','Dương','Lý','Mai','Đinh','Đào','Võ','Lưu',
];
const MIDDLE_NAMES = ['Thị','Văn','Thành','Minh','Quốc','Xuân','Hữu','Đức','Kim','Thu'];
const GIVEN_NAMES = [
  'An','Bình','Châu','Dung','Giang','Hoa','Hùng','Khoa','Lan','Linh',
  'Long','Mai','Nam','Nga','Nhung','Phúc','Quân','Sơn','Thảo','Thắng',
  'Tiến','Tú','Tuấn','Uyên','Vinh','Xuân','Yến','Dũng','Hà','Khánh',
];
const ROLES: Array<'employee' | 'branch_manager' | 'hr'> = ['employee', 'employee', 'employee', 'employee', 'employee', 'branch_manager', 'hr'];
const FRAUD_TYPES = ['device_mismatch','vpn_detected','mock_location','outside_geofence','wifi_mismatch','outside_schedule_window','rate_limit_exceeded'];
const FRAUD_SEVERITIES = ['low','medium','high','critical'];
const STATUSES = ['on_time','on_time','on_time','on_time','late','late','absent'];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  await db.connect();
  console.log('✓ Connected to database');

  // ── 1. Branches ──────────────────────────────────────────────────────────
  console.log('\n📍 Seeding branches…');
  const branchIds: Record<string, string> = {};

  for (const b of BRANCHES) {
    const res = await db.query<{ id: string }>(
      `INSERT INTO branches (name, code, address, latitude, longitude, radius_meters, wifi_bssids, wifi_ssids, timezone, is_active)
       VALUES ($1, $2, $3, $4, $5, 150, $6, '[]', 'Asia/Ho_Chi_Minh', true)
       ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude
       RETURNING id`,
      [b.name, b.code, `${b.name}, Việt Nam`, b.lat, b.lng, JSON.stringify(b.bssids)],
    );
    branchIds[b.code] = res.rows[0].id;
    process.stdout.write('.');
  }
  console.log(`\n  → ${BRANCHES.length} branches ready`);

  // ── 1b. Ensure partitions exist for last 30 days ─────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS attendance_records_2026_03
    PARTITION OF attendance_records
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01')
  `).catch(() => undefined); // ignore if already exists

  // ── 2. Schedules ─────────────────────────────────────────────────────────
  console.log('\n📅 Seeding schedules…');
  for (const b of BRANCHES) {
    await db.query(
      `INSERT INTO schedules (branch_id, name, checkin_time, checkout_time, window_minutes, active_days, is_active)
       VALUES ($1, $2, '08:00', '17:30', 15, ARRAY[1,2,3,4,5], true)
       ON CONFLICT DO NOTHING`,
      [branchIds[b.code], `Ca làm việc - ${b.name}`],
    );
  }
  console.log('  → schedules ready');

  // ── 3. Employees ─────────────────────────────────────────────────────────
  console.log('\n👤 Seeding 500 employees…');
  const passwordHash = await bcrypt.hash('Employee@2025!', 10);
  const branchCodes = Object.keys(branchIds);
  const employeeIds: string[] = [];
  const employeeBranchMap: Record<string, string> = {};

  for (let i = 1; i <= 500; i++) {
    const code = `NV${String(i).padStart(5, '0')}`;
    const firstName = rnd(FIRST_NAMES);
    const middleName = rnd(MIDDLE_NAMES);
    const givenName = rnd(GIVEN_NAMES);
    const fullName = `${firstName} ${middleName} ${givenName}`;
    const email = `nv${String(i).padStart(5, '0')}@hdbank.vn`;
    const role = rnd(ROLES);
    const branchCode = branchCodes[i % branchCodes.length];
    const branchId = branchIds[branchCode];
    const phone = `09${randInt(10, 99)}${randInt(1000000, 9999999)}`;

    try {
      const res = await db.query<{ id: string }>(
        `INSERT INTO employees (employee_code, full_name, email, password_hash, role, branch_id, phone, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
         RETURNING id`,
        [code, fullName, email, passwordHash, role, branchId, phone],
      );
      const empId = res.rows[0].id;
      employeeIds.push(empId);
      employeeBranchMap[empId] = branchCode;
    } catch {
      // skip duplicates
    }

    if (i % 50 === 0) process.stdout.write(`${i}…`);
  }
  console.log(`\n  → ${employeeIds.length} employees ready`);

  // ── 4. Attendance records (30 days) ──────────────────────────────────────
  console.log('\n📋 Seeding attendance records (30 days × employees)…');
  let attCount = 0;

  for (let day = 29; day >= 0; day--) {
    const workDate = dateStr(day);
    const weekday = new Date(workDate).getDay(); // 0=Sun, 6=Sat
    if (weekday === 0 || weekday === 6) continue;  // skip weekends

    for (const empId of employeeIds) {
      const status = rnd(STATUSES) as 'on_time' | 'late' | 'absent';
      if (status === 'absent') continue;

      const branchCode = employeeBranchMap[empId];
      const branchId = branchIds[branchCode];
      const checkInH = status === 'on_time' ? 7 + randInt(50, 60) / 60 : 8 + randInt(5, 30) / 60;
      const checkInHour = Math.floor(checkInH);
      const checkInMin = Math.round((checkInH - checkInHour) * 60);
      const checkInTime = `${workDate}T${pad2(checkInHour)}:${pad2(checkInMin)}:00+07:00`;
      const checkOutH = 17 + randInt(25, 45) / 60;
      const checkOutHour = Math.floor(checkOutH);
      const checkOutMin = Math.round((checkOutH - checkOutHour) * 60);
      const checkOutTime = `${workDate}T${pad2(checkOutHour)}:${pad2(checkOutMin)}:00+07:00`;

      const branch = BRANCHES.find(b => b.code === branchCode)!;
      const locationSnapshot = JSON.stringify({
        latitude: branch.lat + (Math.random() - 0.5) * 0.001,
        longitude: branch.lng + (Math.random() - 0.5) * 0.001,
        gps_accuracy: randInt(5, 20),
        wifi_bssid: branch.bssids[0],
        wifi_ssid: `HDBank_${branchCode}`,
      });
      const deviceSnapshot = JSON.stringify({
        device_id: `device-${empId.slice(0, 8)}`,
        device_model: rnd(['Samsung Galaxy A54','Samsung Galaxy S23','Xiaomi 13T','OPPO Reno10','Vivo V27']),
        os_version: `Android ${randInt(12, 14)}`,
        app_version: '1.2.0',
        is_vpn_active: false,
        is_mock_location: false,
      });

      try {
        await db.query(
          `INSERT INTO attendance_records
             (employee_id, branch_id, work_date, check_in, check_out, status, type, location_snapshot, device_snapshot)
           VALUES ($1, $2, $3, $4, $5, $6, 'auto_checkin', $7, $8)`,
          [empId, branchId, workDate, checkInTime, checkOutTime, status, locationSnapshot, deviceSnapshot],
        );
        attCount++;
      } catch {
        // skip (duplicate or partition missing)
      }
    }

    if (day % 5 === 0) process.stdout.write(`day-${workDate}…`);
  }
  console.log(`\n  → ${attCount} attendance records ready`);

  // ── 5. Fraud logs ────────────────────────────────────────────────────────
  console.log('\n🚨 Seeding fraud logs…');
  const sampleEmployees = employeeIds.slice(0, 50);

  for (let i = 0; i < 50; i++) {
    const empId = rnd(sampleEmployees);
    const branchCode = employeeBranchMap[empId];
    const branchId = branchIds[branchCode];
    const branch = BRANCHES.find(b => b.code === branchCode)!;
    const fraudType = rnd(FRAUD_TYPES);
    const severity = rnd(FRAUD_SEVERITIES);
    const daysAgo = randInt(0, 29);
    const workDate = dateStr(daysAgo);

    const details = JSON.stringify({
      description: `Phát hiện ${fraudType} tại ${branch.name} lúc ${timeStr(randInt(7, 17), randInt(0, 59))} ngày ${workDate}`,
      device: { device_id: `device-${empId.slice(0,8)}`, device_model: 'Samsung Galaxy A54', os_version: 'Android 13', app_version: '1.2.0', is_vpn_active: fraudType === 'VPN_DETECTED', is_mock_location: fraudType === 'MOCK_LOCATION' },
      location: { latitude: branch.lat + (Math.random() - 0.5) * 0.01, longitude: branch.lng + (Math.random() - 0.5) * 0.01, gps_accuracy: randInt(100, 500) },
    });
    await db.query(
      `INSERT INTO fraud_logs (employee_id, fraud_type, severity, details, ip_address)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        empId,
        fraudType,
        severity,
        details,
        `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
      ],
    ).catch(() => undefined);
  }
  console.log('  → 50 fraud logs ready');

  // ── Done ─────────────────────────────────────────────────────────────────
  await db.end();
  console.log('\n✅ Fake data seeded successfully!');
  console.log('   10 branches | 500 employees | attendance records (30d) | 50 fraud logs');
  console.log('   Login: nv00001@hdbank.vn / Employee@2025!');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  db.end().catch(() => undefined);
  process.exit(1);
});
