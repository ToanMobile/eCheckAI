/**
 * record-portal-demo.mjs
 * Tự động thao tác toàn bộ tính năng portal và xuất video demo.
 * Output: /Volumes/Data/GalaxyHolding/HDBankConnect/portal-demo.webm
 */

import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const ROOT = '/Volumes/Data/GalaxyHolding/HDBankConnect';
const BASE_URL = 'http://localhost:5173';
const VIDEO_DIR = path.join(ROOT, '_video_tmp');
const OUT_FILE = path.join(ROOT, 'portal-demo.webm');

// Helpers
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pause(ms = 1200) { await sleep(ms); }

async function typeSlowly(page, selector, text, opts = {}) {
  await page.fill(selector, '');
  await page.type(selector, text, { delay: 60, ...opts });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  fs.mkdirSync(VIDEO_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: VIDEO_DIR,
      size: { width: 1440, height: 900 },
    },
  });

  const page = await context.newPage();
  page.setDefaultTimeout(15000);

  console.log('🎬 Bắt đầu quay video portal demo...\n');

  // ══════════════════════════════════════════════════════
  // 1. TRANG LOGIN
  // ══════════════════════════════════════════════════════
  console.log('1️⃣  Trang Login');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await pause(1500);

  // Nhập email
  await page.click('input[type="email"], input[name="email"], input[placeholder*="mail" i]');
  await pause(400);
  await typeSlowly(page, 'input[type="email"], input[name="email"], input[placeholder*="mail" i]', 'admin@smartattendance.vn');
  await pause(600);

  // Nhập mật khẩu
  await page.click('input[type="password"]');
  await pause(400);
  await typeSlowly(page, 'input[type="password"]', 'SuperAdmin@2025!');
  await pause(800);

  // Click Login
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
  await page.waitForLoadState('networkidle');
  await pause(2000);

  // ══════════════════════════════════════════════════════
  // 2. DASHBOARD
  // ══════════════════════════════════════════════════════
  console.log('2️⃣  Dashboard');
  await pause(1500);

  // Cuộn xuống xem stats + chart
  await page.mouse.wheel(0, 400);
  await pause(1000);
  await page.mouse.wheel(0, 400);
  await pause(1200);
  await page.mouse.wheel(0, -800);
  await pause(800);

  // ══════════════════════════════════════════════════════
  // 3. QUẢN LÝ CHI NHÁNH
  // ══════════════════════════════════════════════════════
  console.log('3️⃣  Quản lý Chi nhánh');
  // Click sidebar "Chi nhánh" hoặc "Branches"
  const branchLink = page.locator('a[href*="branch"], a:has-text("Chi nhánh"), a:has-text("Branch"), nav a:nth-child(2)').first();
  await branchLink.click({ timeout: 8000 }).catch(async () => {
    await page.goto(`${BASE_URL}/branches`, { waitUntil: 'networkidle' });
  });
  await page.waitForLoadState('networkidle');
  await pause(1500);

  // Cuộn xem danh sách
  await page.mouse.wheel(0, 300);
  await pause(800);

  // Click vào branch đầu tiên để xem detail
  const firstBranchRow = page.locator('table tbody tr, [data-testid="branch-row"], .branch-item').first();
  const hasBranchRow = await firstBranchRow.count() > 0;
  if (hasBranchRow) {
    await firstBranchRow.click();
    await pause(1200);
    // Cuộn xem form detail
    await page.mouse.wheel(0, 300);
    await pause(800);
    await page.mouse.wheel(0, -300);
    await pause(600);
  }

  // Mở form tạo mới (nút Add / Thêm)
  const addBranchBtn = page.locator('button:has-text("Thêm"), button:has-text("Add"), button:has-text("Tạo"), button:has-text("New branch")').first();
  const hasAddBtn = await addBranchBtn.count() > 0;
  if (hasAddBtn) {
    await addBranchBtn.click();
    await pause(1200);
    // Điền vào form
    const nameInput = page.locator('input[name="name"], input[placeholder*="tên" i], input[placeholder*="name" i]').first();
    if (await nameInput.count() > 0) {
      await typeSlowly(page, 'input[name="name"], input[placeholder*="tên" i], input[placeholder*="name" i]', 'HDBank Demo');
      await pause(400);
    }
    // Đóng / Cancel
    const cancelBtn = page.locator('button:has-text("Hủy"), button:has-text("Cancel"), button:has-text("Đóng")').first();
    if (await cancelBtn.count() > 0) {
      await cancelBtn.click();
      await pause(800);
    } else {
      await page.keyboard.press('Escape');
      await pause(800);
    }
  }

  await pause(1000);

  // ══════════════════════════════════════════════════════
  // 4. QUẢN LÝ CA LÀM VIỆC (SCHEDULE)
  // ══════════════════════════════════════════════════════
  console.log('4️⃣  Quản lý Ca làm việc');
  const scheduleLink = page.locator('a[href*="schedule"], a:has-text("Ca làm"), a:has-text("Schedule"), a:has-text("Lịch")').first();
  await scheduleLink.click({ timeout: 8000 }).catch(async () => {
    await page.goto(`${BASE_URL}/schedules`, { waitUntil: 'networkidle' });
  });
  await page.waitForLoadState('networkidle');
  await pause(1500);

  await page.mouse.wheel(0, 300);
  await pause(800);

  // Click row đầu tiên
  const firstScheduleRow = page.locator('table tbody tr').first();
  if (await firstScheduleRow.count() > 0) {
    await firstScheduleRow.click();
    await pause(1000);
    await page.keyboard.press('Escape');
    await pause(600);
  }

  // Mở dialog tạo schedule mới
  const addScheduleBtn = page.locator('button:has-text("Thêm"), button:has-text("Add"), button:has-text("Tạo ca"), button:has-text("New")').first();
  if (await addScheduleBtn.count() > 0) {
    await addScheduleBtn.click();
    await pause(1000);
    const cancelBtn2 = page.locator('button:has-text("Hủy"), button:has-text("Cancel")').first();
    if (await cancelBtn2.count() > 0) {
      await cancelBtn2.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await pause(600);
  }

  await pause(1000);

  // ══════════════════════════════════════════════════════
  // 5. QUẢN LÝ NHÂN VIÊN
  // ══════════════════════════════════════════════════════
  console.log('5️⃣  Quản lý Nhân viên');
  const empLink = page.locator('a[href*="employee"], a:has-text("Nhân viên"), a:has-text("Employee")').first();
  await empLink.click({ timeout: 8000 }).catch(async () => {
    await page.goto(`${BASE_URL}/employees`, { waitUntil: 'networkidle' });
  });
  await page.waitForLoadState('networkidle');
  await pause(1500);

  // Xem bảng danh sách
  await page.mouse.wheel(0, 300);
  await pause(800);
  await page.mouse.wheel(0, 300);
  await pause(600);
  await page.mouse.wheel(0, -600);
  await pause(600);

  // Thử tìm kiếm
  const searchInput = page.locator('input[placeholder*="tìm" i], input[placeholder*="search" i], input[type="search"]').first();
  if (await searchInput.count() > 0) {
    await searchInput.click();
    await typeSlowly(page, 'input[placeholder*="tìm" i], input[placeholder*="search" i], input[type="search"]', 'Nguyen');
    await pause(1200);
    await searchInput.clear();
    await pause(600);
  }

  // Click vào nhân viên đầu tiên
  const firstEmpRow = page.locator('table tbody tr').first();
  if (await firstEmpRow.count() > 0) {
    await firstEmpRow.click();
    await pause(1200);
    await page.mouse.wheel(0, 200);
    await pause(600);
    const closeBtn = page.locator('button:has-text("Đóng"), button:has-text("Close"), button[aria-label*="close"]').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await pause(600);
  }

  await pause(1000);

  // ══════════════════════════════════════════════════════
  // 6. CHẤM CÔNG (ATTENDANCE)
  // ══════════════════════════════════════════════════════
  console.log('6️⃣  Chấm công Attendance');
  const attLink = page.locator('a[href*="attendance"], a:has-text("Chấm công"), a:has-text("Attendance")').first();
  await attLink.click({ timeout: 8000 }).catch(async () => {
    await page.goto(`${BASE_URL}/attendance`, { waitUntil: 'networkidle' });
  });
  await page.waitForLoadState('networkidle');
  await pause(1500);

  // Xem bảng
  await page.mouse.wheel(0, 300);
  await pause(800);
  await page.mouse.wheel(0, 400);
  await pause(800);
  await page.mouse.wheel(0, -700);
  await pause(600);

  // Filter theo ngày (nếu có date picker)
  const datePicker = page.locator('input[type="date"], input[placeholder*="date" i], input[placeholder*="ngày" i]').first();
  if (await datePicker.count() > 0) {
    await datePicker.click();
    await pause(600);
    await page.keyboard.press('Escape');
    await pause(400);
  }

  // Thử export CSV nếu có nút
  const exportBtn = page.locator('button:has-text("Export"), button:has-text("Xuất"), a:has-text("CSV")').first();
  if (await exportBtn.count() > 0) {
    await exportBtn.scrollIntoViewIfNeeded();
    await pause(400);
    await exportBtn.hover();
    await pause(800);
  }

  await pause(1000);

  // ══════════════════════════════════════════════════════
  // 6.5 PHÁT HIỆN GIAN LẬN (FRAUD LOGS)
  // ══════════════════════════════════════════════════════
  console.log('6️⃣ ½ Phát hiện gian lận');
  const fraudLink = page.locator('a[href*="fraud"], a:has-text("Phát hiện gian lận"), a:has-text("Gian lận"), a:has-text("Fraud")').first();
  await fraudLink.click({ timeout: 8000 }).catch(async () => {
    await page.goto(`${BASE_URL}/fraud`, { waitUntil: 'networkidle' });
  });
  await page.waitForLoadState('networkidle');
  await pause(1800);

  // Cuộn xem danh sách fraud logs
  await page.mouse.wheel(0, 300);
  await pause(800);
  await page.mouse.wheel(0, 400);
  await pause(800);
  await page.mouse.wheel(0, -700);
  await pause(600);

  // Thử filter theo severity
  const severitySelect = page.locator('select').first();
  if (await severitySelect.count() > 0) {
    await severitySelect.click();
    await pause(500);
    await page.keyboard.press('Escape');
    await pause(500);
  }

  // Click vào fraud log đầu tiên để xem detail modal
  const firstFraudRow = page.locator('table tbody tr').first();
  if (await firstFraudRow.count() > 0) {
    await firstFraudRow.click();
    await pause(1500);
    // Cuộn trong modal
    await page.mouse.wheel(0, 300);
    await pause(800);
    await page.mouse.wheel(0, -300);
    await pause(600);
    // Đóng modal
    const closeBtn = page.locator('button:has-text("Đóng"), button:has-text("Close"), button[aria-label*="close" i]').first();
    if (await closeBtn.count() > 0) {
      await closeBtn.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await pause(800);
  }

  await pause(1000);

  // ══════════════════════════════════════════════════════
  // 7. QUAY LẠI DASHBOARD — KẾT THÚC
  // ══════════════════════════════════════════════════════
  console.log('7️⃣  Quay về Dashboard');
  const dashLink = page.locator('a[href*="dashboard"], a:has-text("Dashboard"), a:has-text("Tổng quan"), nav a:first-child').first();
  await dashLink.click({ timeout: 8000 }).catch(async () => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  });
  await page.waitForLoadState('networkidle');
  await pause(2000);

  // Cuộn một vòng để kết thúc đẹp
  await page.mouse.wheel(0, 500);
  await pause(800);
  await page.mouse.wheel(0, -500);
  await pause(1500);

  // ══════════════════════════════════════════════════════
  // XUẤT VIDEO
  // ══════════════════════════════════════════════════════
  console.log('\n⏹  Dừng quay, xuất video...');
  const videoPath = await page.video()?.path();
  await context.close();
  await browser.close();

  if (videoPath && fs.existsSync(videoPath)) {
    fs.copyFileSync(videoPath, OUT_FILE);
    fs.rmSync(VIDEO_DIR, { recursive: true, force: true });
    const size = (fs.statSync(OUT_FILE).size / 1024 / 1024).toFixed(1);
    console.log(`\n✅ Video đã xuất: ${OUT_FILE}`);
    console.log(`   Kích thước: ${size} MB`);
  } else {
    console.error('❌ Không tìm thấy file video. Path:', videoPath);
    process.exit(1);
  }
})();
