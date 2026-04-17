# eCheckAI V2

> **Hệ thống chấm công Zero-Touch** — nhân viên không cần chạm vào điện thoại.  
> Tự động xác minh WiFi BSSID + GPS Geofencing + Anti-fraud 9 lớp, chạy hoàn toàn ngầm.

Built by **Giải Pháp Số** · ⏱ **2 days build** · 🏢 **100 chi nhánh · 5.000 nhân viên**

---

```
  5,000 nhân viên         100 chi nhánh        ~7,500 LoC
  đồng thời check-in      quản lý độc lập      3 platform apps
  trong 15 phút           WiFi + GPS + ca       Backend · Mobile · Web
```

---

## Vấn đề cần giải quyết

Chấm công thủ công có 3 điểm chết:

| Vấn đề | Thực tế |
|--------|---------|
| Quên bấm | Nhân viên bận, không nhớ mở app mỗi sáng |
| Gian lận | Nhờ đồng nghiệp chấm hộ, chấm từ nhà bằng VPN/GPS giả |
| Dữ liệu chậm | Manager không biết ai đến ai vắng cho đến tối |

eCheckAI V2 loại bỏ cả ba: **chạy ngầm tự động, chống gian lận đa lớp, realtime dashboard**.

---

## Cách hoạt động

```
  Scheduler nền kích hoạt
  (mỗi 15 phút, không cần mở app)
           │
           ├─ Hôm nay có ca làm? ──────── Không → bỏ qua
           ├─ Đang trong khung giờ? ────── Không → bỏ qua
           │
           ├─ WiFi BSSID khớp chi nhánh? ─ Không → log + bỏ qua
           ├─ GPS trong bán kính? ───────── Không → log + bỏ qua
           ├─ VPN / Mock GPS? ───────────── Có    → reject + fraud log
           │
           └─ POST /attendance/auto-checkin
                    │
                    ├─ Server re-validate toàn bộ điều kiện
                    ├─ Xác định: on_time / late
                    ├─ Ghi DB + publish WebSocket event
                    └─ Nhân viên nhận notification ✅ (không cần mở app)
```

---

## Tính năng

### Zero-Touch Check-in / Check-out
- Chạy nền bằng **Android WorkManager** / **iOS BGTaskScheduler** — không cần mở app
- Xác minh **WiFi BSSID** (MAC address) + **GPS Haversine** trước khi gửi API
- Phân loại tự động: `on_time` / `late` / `absent`
- Offline-first: mất mạng → lưu SQLite queue → batch sync khi có kết nối lại
- Idempotency key đảm bảo không bao giờ duplicate record dù sync nhiều lần

### Anti-Fraud 9 lớp

| # | Kiểm tra | Phía | Severity |
|---|----------|------|----------|
| 1 | Device binding — chỉ thiết bị đã đăng ký | Server | CRITICAL |
| 2 | VPN detection — mobile + server IP (ipinfo.io) | Mobile + Server | HIGH |
| 3 | Mock GPS — emulated location API | Mobile + Server | HIGH |
| 4 | GPS geofence — Haversine ≤ radius_meters | Both | MEDIUM |
| 5 | WiFi BSSID — MAC trong whitelist chi nhánh | Both | MEDIUM |
| 6 | Rate limit — max 2 check-in / ngày / người | Server | HIGH |
| 7 | Schedule window — ±window_minutes từ giờ vào | Both | — |
| 8 | GPS accuracy — ≤ 50m required | Server | — |
| 9 | Device farming — màn hình unlock < 90 phút | Mobile | MEDIUM |

### Realtime Admin Dashboard
- **WebSocket (Socket.IO)** push event check-in/out/fraud ngay khi xảy ra
- Role-based rooms: `super_admin` → toàn công ty · `branch_manager` → chi nhánh mình
- Live feed + biểu đồ trend 7 ngày (Recharts)
- Fraud log với severity levels + resolution workflow

### Quản lý đa chi nhánh
- Mỗi chi nhánh config độc lập: BSSID list, GPS center + radius, timezone, ca làm việc
- Redis cache 6 giờ cho branch config — check-in API không bao giờ hit DB trực tiếp
- Soft delete an toàn — lịch sử không bao giờ mất

### Export & Notification
- CSV export tối đa 31 ngày, filter theo chi nhánh / trạng thái / nhân viên
- **Telegram Bot** + **Zalo OA** + **Email SMTP** — alert trễ, vắng, fraud
- Báo cáo vắng mặt tự động cuối ngày (cron)

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│                         CLIENTS                            │
│  ┌──────────────────┐        ┌────────────────────────┐    │
│  │  React Native    │        │  React 18 PWA          │    │
│  │  Android + iOS   │        │  Manager / HR / Admin  │    │
│  └────────┬─────────┘        └──────────┬─────────────┘    │
└───────────┼──────────────────────────────┼─────────────────┘
            │ HTTPS                         │ HTTPS / WSS
            ▼                               ▼
     ┌─────────────────────────────────────────────┐
     │           Nginx  ·  TLS  ·  WS Proxy        │
     └──────────────────────┬──────────────────────┘
                            │
               ┌────────────┴────────────┐
               ▼                         ▼
      ┌─────────────────┐      ┌──────────────────┐
      │  NestJS :3000   │      │  React PWA       │
      │  REST + WS      │      │  (Nginx static)  │
      └──┬──────────┬───┘      └──────────────────┘
         │          │ Redis Pub/Sub
    ┌────▼───┐  ┌───▼─────┐
    │  PG 16 │  │ Redis 7 │
    └────────┘  └─────────┘
```

### Backend Modules

```
modules/
├── auth/           JWT · device registration · OTP reset
├── employee/       CRUD · 4 roles · device binding
├── branch/         Config · WiFi/GPS · Redis cache 6h
├── schedule/       Ca làm · time windows · active days
├── attendance/     Auto checkin/out · manual · self-service
│   └── validators/ wifi · geo · schedule
├── fraud/          Detection · logging · resolution
├── sync/           Offline batch sync · idempotency dedup
├── notification/   Telegram · Zalo · Email adapters
└── realtime/       Socket.IO gateway · Redis pub/sub
```

---

## Tech Stack

### Backend
| | Công nghệ | Chi tiết |
|--|-----------|---------|
| Runtime | Node.js 20 LTS | — |
| Framework | NestJS 10 | TypeScript strict mode |
| Database | PostgreSQL 16 | TypeORM · migrations · monthly partitioning |
| Cache | Redis 7 | Branch config · rate limiting · pub/sub |
| Auth | JWT | Access 15m · Refresh 7d |
| Realtime | Socket.IO 4 | WebSocket · role-based rooms |
| Validation | class-validator | DTO decorators trên mọi endpoint |
| Security | bcrypt 12r · pgcrypto | Password hash · at-rest encryption |

### Mobile
| | Công nghệ | Chi tiết |
|--|-----------|---------|
| Framework | React Native 0.73+ | New Architecture enabled |
| Background | react-native-background-fetch | WorkManager (Android) · BGTaskScheduler (iOS) |
| WiFi | react-native-wifi-reborn | BSSID MAC scan |
| GPS | react-native-geolocation-service | High accuracy · mock detection |
| Offline DB | react-native-sqlite-storage | Queue persistence |
| State | Zustand + AsyncStorage | Schedule cache · auth tokens |

### Admin Dashboard
| | Công nghệ | Chi tiết |
|--|-----------|---------|
| Framework | React 18 + Vite | PWA-ready |
| UI | Tailwind CSS + shadcn/ui | — |
| Charts | Recharts | Attendance trends · stats |
| Realtime | Socket.IO Client | Auto-reconnect · role rooms |
| Data | React Query + Zustand | Server + client state |

### Infrastructure
| | Công nghệ |
|--|-----------|
| Container | Docker + docker-compose |
| Proxy | Nginx (TLS termination · WebSocket upgrade) |
| CI/CD | GitHub Actions → GHCR |

---

## Scale

### Hiện tại: 5.000 nhân viên · 100 chi nhánh
- Peak load: 5.000 check-in trong 15 phút = **5,5 req/sec** — single instance xử lý thoải mái
- Redis cache loại bỏ **90% DB reads** (branch config · schedule · employee lookup)
- PostgreSQL monthly partitioning sẵn sàng cho dữ liệu lớn

### Lên 50.000 nhân viên — không cần viết lại

| Bottleneck | Giải pháp đã chuẩn bị |
|------------|----------------------|
| API throughput | 3–5 NestJS instances + Nginx upstream |
| Read load | PostgreSQL read replicas cho dashboard |
| Data volume | Attendance partitioned by month · auto-prune 2 năm |
| Cache | Redis Cluster 3 nodes |
| Notifications | Bull queue async delivery |
| Observability | Prometheus + Grafana |

---

## Database

```
branches          employees          schedules
   │                  │                  │
   └──────────────────┴──────────────────┘
                       │
              attendance_records          fraud_logs
              [partitioned/month]         [1 year retention]
                       │
                  sync_queue
                  [idempotency_key UNIQUE]
```

7 tables · 8+ indexes · JSONB cho `location_snapshot`, `device_snapshot`, `fraud_details`

---

## API — 30+ Endpoints

```
Auth         login · refresh · register-device · forgot/reset-password
Attendance   auto-checkin · auto-checkout · manual · self-manual
             my · list · stats · export(CSV) · recent
Branch       CRUD · soft-delete
Schedule     CRUD · /my (employee schedule)
Employee     CRUD · soft-delete
Sync         batch · status
Fraud        logs · recent
Health       /health
```

→ Swagger UI: `http://localhost:3000/api/docs`

---

## Security

- JWT trong `Authorization: Bearer` — không bao giờ trong URL params
- BSSID whitelist server-side only — mobile chỉ fetch qua authenticated API
- Device binding 1-1 per employee — admin reset khi cần
- Rate limiting: 10 req/phút/người trên attendance endpoints
- Location data encrypted at rest (pgcrypto)
- Fraud logs retained 1 năm (compliance)
- CORS whitelist: PWA domain + mobile bundle ID only
- TypeORM parameterized queries — no raw SQL concatenation

---

## Tích hợp & Setup

Xem **[INTEGRATION_GUIDE.md](INTEGRATION_GUIDE.md)** để biết chi tiết:

- Luồng Authentication đầy đủ (login → register device → refresh token)
- Auto check-in request body + 9-step server validation flow
- Offline sync với idempotency key + SQLite schema
- Background Scheduler Android (BackgroundFetch) + iOS (BGTaskScheduler)
- WebSocket realtime setup + events + role-based rooms
- CSV export usage
- Docker quick start (dev + production)
- Environment variables reference
- Error codes & timeout handling
- Postman collection

---

## License

Proprietary — Giải Pháp Số © 2025
