# Integration Guide — eCheckAI V2

Hướng dẫn tích hợp đầy đủ cho developer muốn kết nối mobile app, admin dashboard, hoặc hệ thống bên thứ ba vào eCheckAI V2.

---

## Mục lục

1. [Xác thực (Authentication)](#1-xác-thực-authentication)
2. [Auto Check-in từ Mobile](#2-auto-check-in-từ-mobile)
3. [Offline Sync](#3-offline-sync)
4. [Background Scheduler (Mobile)](#4-background-scheduler-mobile)
5. [Admin Dashboard — WebSocket Realtime](#5-admin-dashboard--websocket-realtime)
6. [Export CSV Attendance](#6-export-csv-attendance)
7. [Webhook / Notification Bot](#7-webhook--notification-bot)
8. [Lỗi thường gặp & cách xử lý](#8-lỗi-thường-gặp--cách-xử-lý)
9. [Postman Collection nhanh](#9-postman-collection-nhanh)
10. [Quick Start (Dev & Production)](#10-quick-start-dev--production)
11. [Environment Variables](#11-environment-variables)
12. [Chạy Tests](#12-chạy-tests)
13. [Git Flow & Conventions](#13-git-flow--conventions)

1. [Xác thực (Authentication)](#1-xác-thực-authentication)
2. [Auto Check-in từ Mobile](#2-auto-check-in-từ-mobile)
3. [Offline Sync](#3-offline-sync)
4. [Background Scheduler (Mobile)](#4-background-scheduler-mobile)
5. [Admin Dashboard — WebSocket Realtime](#5-admin-dashboard--websocket-realtime)
6. [Export CSV Attendance](#6-export-csv-attendance)
7. [Webhook / Notification Bot](#7-webhook--notification-bot)
8. [Lỗi thường gặp & cách xử lý](#8-lỗi-thường-gặp--cách-xử-lý)
9. [Postman Collection nhanh](#9-postman-collection-nhanh)

---

## 1. Xác thực (Authentication)

### 1.1 Đăng nhập

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "employee@hdbank.vn",
  "password": "secret",
  "device_id": "unique-device-uuid"
}
```

**Response thành công:**

```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGci...",
    "refresh_token": "eyJhbGci...",
    "expires_in": 900,
    "user": {
      "id": "uuid",
      "email": "employee@hdbank.vn",
      "full_name": "Nguyễn Văn A",
      "role": "employee",
      "branch_id": "uuid",
      "registered_device_id": "unique-device-uuid"
    }
  }
}
```

### 1.2 Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refresh_token": "eyJhbGci..."
}
```

### 1.3 Đăng ký thiết bị (bắt buộc trước khi auto check-in)

```http
POST /api/v1/auth/register-device
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "device_id": "unique-device-uuid",
  "device_model": "Samsung Galaxy S24",
  "os_version": "Android 14",
  "app_version": "1.2.0"
}
```

> **Lưu ý:** Mỗi nhân viên chỉ được đăng ký 1 thiết bị. Thiết bị thứ 2 sẽ bị từ chối cho đến khi admin reset.

### 1.4 Gắn token vào mọi request

```
Authorization: Bearer {access_token}
```

Access token hết hạn sau **15 phút**. Khi nhận `401 Unauthorized`, dùng refresh token để lấy cặp token mới. Nếu refresh token cũng hết hạn (7 ngày), yêu cầu nhân viên đăng nhập lại.

---

## 2. Auto Check-in từ Mobile

### 2.1 Lấy lịch làm việc của nhân viên

Gọi khi app khởi động hoặc khi schedule cần refresh:

```http
GET /api/v1/schedules/my
Authorization: Bearer {access_token}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "branch_id": "uuid",
    "shift_name": "Ca Hành Chính",
    "checkin_time": "08:00",
    "checkout_time": "17:30",
    "window_minutes": 15,
    "active_days": [1, 2, 3, 4, 5],
    "timezone": "Asia/Ho_Chi_Minh"
  }
}
```

Cache vào `AsyncStorage` — chỉ sync lại khi app foreground hoặc mỗi 6 giờ.

### 2.2 Lấy config chi nhánh (BSSID whitelist)

```http
GET /api/v1/branches/{branch_id}
Authorization: Bearer {access_token}
```

**Response quan trọng:**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "HDBank Quận 1",
    "latitude": 10.7769,
    "longitude": 106.7009,
    "radius_meters": 100,
    "wifi_bssids": ["AA:BB:CC:DD:EE:FF", "11:22:33:44:55:66"],
    "timezone": "Asia/Ho_Chi_Minh"
  }
}
```

> **Bảo mật:** BSSID list chỉ trả về qua API có auth. Không bao giờ hardcode phía mobile.

### 2.3 Gửi Auto Check-in

```http
POST /api/v1/attendance/auto-checkin
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "employee_id": "uuid",
  "wifi_bssid": "AA:BB:CC:DD:EE:FF",
  "wifi_ssid": "HDBank_CN_Q1",
  "latitude": 10.7769,
  "longitude": 106.7009,
  "gps_accuracy": 12.5,
  "device_id": "unique-device-uuid",
  "device_model": "Samsung Galaxy S24",
  "os_version": "Android 14",
  "app_version": "1.2.0",
  "timestamp": "2025-01-15T08:02:30+07:00",
  "is_vpn_active": false,
  "is_mock_location": false
}
```

**Response thành công:**

```json
{
  "success": true,
  "data": {
    "attendance_id": "uuid",
    "status": "on_time",
    "check_in_time": "2025-01-15T08:02:30+07:00",
    "branch_name": "HDBank Quận 1"
  }
}
```

**Các status có thể nhận:**

| Status | Ý nghĩa |
|--------|---------|
| `on_time` | Đúng giờ (≤ checkin_time) |
| `late` | Trễ (> checkin_time nhưng trong window) |

### 2.4 Gửi Auto Check-out

Tương tự check-in, endpoint:

```http
POST /api/v1/attendance/auto-checkout
```

Body giống hệt check-in.

### 2.5 Luồng validation phía server

Server sẽ từ chối request nếu bất kỳ điều kiện nào dưới đây thất bại:

```
① Parse & validate DTO
② Employee tồn tại + lấy branch_id
③ Branch config (Redis cache)
④ Schedule config (Redis cache)
⑤ FRAUD: device_id khớp registered_device_id
⑥ FRAUD: is_vpn_active === false
⑦ FRAUD: is_mock_location === false
⑧ FRAUD: Server IP check (ipinfo.io)
⑨ FRAUD: Rate limit — max 2 check-in/ngày
⑩ COND: WiFi BSSID trong danh sách chi nhánh
⑪ COND: GPS ≤ radius_meters (haversine)
⑫ COND: GPS accuracy ≤ 50m
⑬ COND: Timestamp trong window ± window_minutes
⑭ → INSERT record + publish Redis event
```

---

## 3. Offline Sync

Khi thiết bị mất mạng, mobile lưu event vào SQLite queue rồi batch sync khi có kết nối lại.

### 3.1 Schema SQLite (mobile)

```sql
CREATE TABLE sync_queue (
  id          TEXT PRIMARY KEY,
  event_type  TEXT NOT NULL,   -- 'auto_checkin' | 'auto_checkout' | 'manual_checkin'
  payload     TEXT NOT NULL,   -- JSON string of check-in body
  idempotency_key TEXT UNIQUE, -- sha256(employee_id + event_type + work_date)
  created_at  INTEGER NOT NULL,
  retry_count INTEGER DEFAULT 0
);
```

### 3.2 Idempotency Key

```typescript
import { sha256 } from 'crypto';

function buildIdempotencyKey(employeeId: string, type: string, workDate: string): string {
  return sha256(`${employeeId}:${type}:${workDate}`);
}
// Ví dụ: sha256("uuid-employee:auto_checkin:2025-01-15")
```

Server dùng key này để dedup — cùng nhân viên + cùng loại + cùng ngày chỉ tạo 1 record dù gửi bao nhiêu lần.

### 3.3 Gửi Batch Sync

```http
POST /api/v1/sync/batch
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "events": [
    {
      "idempotency_key": "sha256-hash",
      "event_type": "auto_checkin",
      "payload": { ...same as auto-checkin body... },
      "occurred_at": "2025-01-15T08:02:30+07:00"
    },
    {
      "idempotency_key": "sha256-hash-2",
      "event_type": "auto_checkout",
      "payload": { ...checkout body... },
      "occurred_at": "2025-01-15T17:31:00+07:00"
    }
  ]
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "processed": 2,
    "failed": 0,
    "results": [
      { "idempotency_key": "hash-1", "status": "success", "attendance_id": "uuid" },
      { "idempotency_key": "hash-2", "status": "duplicate", "attendance_id": "existing-uuid" }
    ]
  }
}
```

### 3.4 Kiểm tra trạng thái sync queue

```http
GET /api/v1/sync/status
Authorization: Bearer {access_token}
```

---

## 4. Background Scheduler (Mobile)

### 4.1 Android — react-native-background-fetch

```typescript
import BackgroundFetch from 'react-native-background-fetch';

BackgroundFetch.configure({
  minimumFetchInterval: 15,     // phút, tối thiểu của OS
  stopOnTerminate: false,
  startOnBoot: true,
  enableHeadless: true,
}, async (taskId) => {
  await AutoCheckinExecutor.run();
  BackgroundFetch.finish(taskId);
}, (taskId) => {
  BackgroundFetch.finish(taskId);
});
```

### 4.2 iOS — BGTaskScheduler

Đăng ký trong `AppDelegate.swift`:

```swift
BGTaskScheduler.shared.register(
  forTaskWithIdentifier: "com.echeck.autoCheckin",
  using: nil
) { task in
  AutoCheckinTask.handle(task as! BGAppRefreshTask)
}
```

Lên lịch lại sau mỗi lần chạy:

```swift
func scheduleAppRefresh() {
  let request = BGAppRefreshTaskRequest(identifier: "com.echeck.autoCheckin")
  request.earliestBeginDate = Date(timeIntervalSinceNow: 15 * 60)
  try? BGTaskScheduler.shared.submit(request)
}
```

### 4.3 Logic kiểm tra trước khi gửi API

```typescript
async function shouldAttemptCheckin(schedule: Schedule): Promise<boolean> {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon...

  // Kiểm tra ngày làm việc
  if (!schedule.active_days.includes(day)) return false;

  // Kiểm tra trong time window
  const windowStart = subMinutes(parseTime(schedule.checkin_time), 5);
  const windowEnd = addMinutes(parseTime(schedule.checkin_time), schedule.window_minutes);
  if (!isWithinInterval(now, { start: windowStart, end: windowEnd })) return false;

  // Kiểm tra chưa check-in hôm nay
  const todayRecord = await getLocalTodayRecord();
  if (todayRecord?.check_in) return false;

  return true;
}
```

---

## 5. Admin Dashboard — WebSocket Realtime

### 5.1 Kết nối Socket.IO

```typescript
import { io } from 'socket.io-client';

const socket = io('https://smartattendance.vn', {
  path: '/socket.io',
  auth: { token: accessToken },
  transports: ['websocket'],
});

socket.on('connect', () => console.log('Realtime connected'));
socket.on('disconnect', (reason) => {
  if (reason === 'io server disconnect') {
    socket.connect(); // token expired — refresh first
  }
});
```

### 5.2 Lắng nghe sự kiện

```typescript
// Check-in mới
socket.on('attendance:checkin', (data) => {
  // data: { attendance_id, employee_id, employee_name, branch_id, status, check_in_time }
  updateLiveFeed(data);
  incrementDashboardStats(data.status);
});

// Check-out mới
socket.on('attendance:checkout', (data) => {
  // data: { attendance_id, employee_id, check_out_time, duration_minutes }
  updateRecord(data);
});

// Phát hiện gian lận
socket.on('fraud:detected', (data) => {
  // data: { fraud_id, employee_id, fraud_type, severity, timestamp }
  showFraudAlert(data);
});
```

### 5.3 Rooms (tự động join theo role)

| Role | Rooms tham gia |
|------|----------------|
| `super_admin` | `global` |
| `hr` | `global` |
| `branch_manager` | `branch:{branch_id}` của branch mình |
| `employee` | `employee:{employee_id}` của bản thân |

---

## 6. Export CSV Attendance

```http
GET /api/v1/attendance/export?branch_id=uuid&date_from=2025-01-01&date_to=2025-01-31&status=late
Authorization: Bearer {access_token}
Accept: text/csv
```

**Giới hạn:** Tối đa 31 ngày / lần export. Vượt quá trả về `400 Bad Request`.

**Columns CSV:**

```
employee_code, full_name, branch_name, work_date, check_in, check_out, status, note
```

**Ví dụ response:**

```
employee_code,full_name,branch_name,work_date,check_in,check_out,status,note
EMP001,Nguyễn Văn A,HDBank Q1,2025-01-15,08:02:30,17:31:00,on_time,
EMP002,Trần Thị B,HDBank Q1,2025-01-15,08:17:45,,late,Trễ 17 phút
EMP003,Lê Văn C,HDBank Q1,2025-01-15,,,absent,Vắng không phép
```

**Role được phép export:** `branch_manager`, `hr`, `super_admin`.

---

## 7. Webhook / Notification Bot

### 7.1 Telegram

Cấu hình trong `backend/.env`:

```env
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_CHAT_GLOBAL_HR=-100xxxxxxxxx
```

Các sự kiện tự động gửi:

| Sự kiện | Nội dung thông báo |
|---------|--------------------|
| Check-in thành công | `✅ [Tên] đã check-in lúc 08:02 — HDBank Q1` |
| Check-in trễ | `⚠️ [Tên] check-in TRỄ 17 phút — HDBank Q1` |
| Phát hiện gian lận | `🚨 FRAUD [HIGH]: VPN detected — [Tên]` |
| Vắng mặt cuối ngày | `📋 Báo cáo vắng: 3 nhân viên vắng hôm nay` |

### 7.2 Zalo OA

```env
ZALO_OA_ACCESS_TOKEN=your-access-token
ZALO_OA_SECRET_KEY=your-secret
ZALO_OA_ID=your-oa-id
```

Gửi OTP reset password và thông báo attendance qua Zalo message.

---

## 8. Lỗi thường gặp & cách xử lý

### HTTP Error Codes

| Code | Error Code | Nguyên nhân | Hành động |
|------|-----------|-------------|-----------|
| `401` | `INVALID_TOKEN` | Token hết hạn | Gọi `/auth/refresh` |
| `401` | `DEVICE_NOT_REGISTERED` | Device chưa đăng ký | Gọi `/auth/register-device` |
| `403` | `DEVICE_MISMATCH` | Đăng nhập từ thiết bị lạ | Yêu cầu admin reset device |
| `403` | `VPN_DETECTED` | VPN đang bật | Thông báo nhân viên tắt VPN |
| `403` | `MOCK_LOCATION_DETECTED` | GPS giả | Thông báo nhân viên tắt mock GPS |
| `403` | `OUTSIDE_GEOFENCE` | Ngoài phạm vi chi nhánh | Không làm gì, log locally |
| `403` | `WIFI_MISMATCH` | WiFi không phải của chi nhánh | Retry sau 5s (tối đa 3 lần) |
| `403` | `OUTSIDE_SCHEDULE_WINDOW` | Ngoài khung giờ | Không làm gì, skip |
| `429` | `RATE_LIMIT_EXCEEDED` | Vượt 2 check-in/ngày | Không retry, log locally |
| `409` | `ALREADY_CHECKED_IN` | Đã check-in hôm nay | Không làm gì, đây là trạng thái bình thường |
| `5xx` | `SERVER_ERROR` | Lỗi server | Lưu vào OfflineQueue, retry sau |

### Xử lý timeout

```typescript
const TIMEOUT_MS = 10_000;

try {
  const result = await Promise.race([
    api.post('/attendance/auto-checkin', payload),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT_MS)
    ),
  ]);
  markDone(result);
} catch (err) {
  if (err.message === 'TIMEOUT' || isNetworkError(err)) {
    // Không biết server nhận chưa → lưu queue để sync
    await offlineQueue.enqueue({ ...payload, idempotency_key });
  } else if (err.response?.status >= 400 && err.response?.status < 500) {
    // 4xx = server đã reject đúng → KHÔNG lưu queue
    logLocally(err.response.data);
  }
}
```

---

## 9. Postman Collection nhanh

Import collection bằng cách tạo file `eCheckAI.postman_collection.json` với biến:

```json
{
  "BASE_URL": "http://localhost:3000/api/v1",
  "ACCESS_TOKEN": "",
  "REFRESH_TOKEN": "",
  "EMPLOYEE_ID": "",
  "BRANCH_ID": "",
  "DEVICE_ID": "test-device-001"
}
```

### Thứ tự thử nghiệm cơ bản

```
1. POST {{BASE_URL}}/auth/login
   → Lấy access_token, refresh_token, employee_id

2. POST {{BASE_URL}}/auth/register-device
   → Bind device_id cho employee

3. GET  {{BASE_URL}}/schedules/my
   → Lấy schedule của nhân viên

4. GET  {{BASE_URL}}/branches/{{BRANCH_ID}}
   → Lấy config BSSID + GPS

5. POST {{BASE_URL}}/attendance/auto-checkin
   → Gửi check-in

6. GET  {{BASE_URL}}/attendance/my
   → Xem lịch sử chấm công

7. POST {{BASE_URL}}/sync/batch
   → Test batch sync offline

8. GET  {{BASE_URL}}/attendance/export?date_from=2025-01-01&date_to=2025-01-31
   → Download CSV
```

---

---

## 10. Quick Start (Dev & Production)

### Yêu cầu
- Docker 24+ và docker-compose v2
- Node.js 20 LTS (nếu chạy local không Docker)

### Development (hot reload)

```bash
# 1. Clone repo
git clone https://github.com/your-org/echeck-ai-v2.git
cd echeck-ai-v2

# 2. Copy env templates
cp backend/.env.example backend/.env
cp web/.env.example web/.env
# Chỉnh sửa với giá trị local

# 3. Start full stack
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 4. Xem logs
docker-compose logs -f backend
```

| Service | URL |
|---------|-----|
| Backend API | http://localhost:3000 |
| Swagger UI | http://localhost:3000/api/docs |
| Admin Dashboard | http://localhost:5173 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

### Production

```bash
# 1. Cấu hình env
cp backend/.env.example backend/.env
cp web/.env.example web/.env
# Điền JWT_SECRET (min 64 chars), DB passwords, Telegram token...

# 2. SSL certificates
mkdir -p nginx/ssl
cp /path/to/cert.pem nginx/ssl/cert.pem
cp /path/to/key.pem  nginx/ssl/key.pem

# 3. Khởi động stack
docker-compose pull
docker-compose up -d

# 4. Kiểm tra health
docker-compose ps
curl https://smartattendance.vn/api/v1/health
```

---

## 11. Environment Variables

### Backend (`backend/.env`)

| Biến | Ví dụ | Bắt buộc |
|------|-------|----------|
| `NODE_ENV` | `production` | ✅ |
| `PORT` | `3000` | ✅ |
| `JWT_SECRET` | `openssl rand -hex 64` | ✅ |
| `DB_HOST` | `postgres` | ✅ |
| `DB_PORT` | `5432` | ✅ |
| `DB_NAME` | `echeck_db` | ✅ |
| `DB_USER` | `echeck_user` | ✅ |
| `DB_PASS` | `strong-password` | ✅ |
| `REDIS_HOST` | `redis` | ✅ |
| `REDIS_PORT` | `6379` | ✅ |
| `CORS_ORIGINS` | `https://dashboard.vn` | ✅ |
| `TELEGRAM_BOT_TOKEN` | `123456:ABC...` | Nếu dùng Telegram |
| `ZALO_OA_ACCESS_TOKEN` | `...` | Nếu dùng Zalo |
| `IPINFO_API_TOKEN` | `...` | Server-side VPN check |
| `SMTP_HOST` | `smtp.gmail.com` | Nếu dùng Email |

Xem đầy đủ tại `backend/.env.example`.

### Web (`web/.env`)

```env
VITE_API_URL=http://localhost:3000/api/v1
VITE_WS_URL=http://localhost:3000
VITE_APP_NAME=eCheckAI
```

> **Lưu ý bảo mật:** Rotate `JWT_SECRET`, `POSTGRES_PASSWORD`, `TELEGRAM_BOT_TOKEN` mỗi 90 ngày. Generate JWT secret: `openssl rand -hex 64`

---

## 12. Chạy Tests

```bash
# Backend unit tests
cd backend
npm ci
npm run test

# Backend unit tests với coverage
npm run test -- --coverage

# Backend e2e tests (cần Postgres + Redis đang chạy)
npm run test:e2e

# Web type-check + build
cd web
npm ci
npm run build
```

Coverage target: **80%** services · **60%** controllers.

Test naming convention: `should_[expected]_when_[condition]`

---

## 13. Git Flow & Conventions

```
main              ← production-ready, protected, SemVer tagged
└── develop       ← integration branch
    ├── feature/SA-001-db-schema
    ├── feature/SA-004-auto-checkin-api
    ├── feature/SA-005-fraud-detection
    ├── feature/SA-006-background-scheduler
    └── fix/SA-xxx-description
```

### Conventional Commits

```
feat(attendance): add auto-checkin API with schedule validation
fix(fraud): correct VPN detection on Android 14+
refactor(branch): extract WiFi validation to shared util
test(e2e): add offline sync flow test
chore(docker): update postgres image to 16.2
```

### Rules
- Mỗi feature tạo từ `develop`, merge qua Pull Request
- Squash merge vào `develop`, rebase merge vào `main`
- Tag version theo SemVer: `v1.0.0`, `v1.1.0`, ...

---

## Liên hệ hỗ trợ

- **Swagger UI (dev):** http://localhost:3000/api/docs
- **Swagger UI (prod):** https://smartattendance.vn/api/docs _(admin only)_
- **Health check:** GET /api/v1/health
- **Issues:** Liên hệ team Giải Pháp Số
