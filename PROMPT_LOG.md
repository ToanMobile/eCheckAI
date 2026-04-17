# PROMPT_LOG.md — eCheckAI V2

> Ghi chép quá trình làm việc với AI (Claude Code) để xây dựng dự án **eCheckAI V2** — hệ thống chấm công Zero-Touch cho 100 chi nhánh, 5.000 nhân viên.
>
> AI Tool: **Claude Code** (Anthropic) — claude-opus-4-6 (1M context)
> Author: VanToan — Đội Giải Pháp Số
> Repo: `echeck-ai-v2`

---

## 1. Triết lý làm việc với AI

| Nguyên tắc | Áp dụng cụ thể |
|---|---|
| **Spec-first** | Viết CLAUDE.md (mô tả kiến trúc, conventions, flows) + 7 tài liệu docs/ (AUTH, SCHEMA, WS, SYNC, TESTS...) trước khi sinh code |
| **Context thay vì prompt dài** | Tất cả ràng buộc (tech stack, naming, security) để vào CLAUDE.md, rồi AI tự dựa vào đó |
| **Agent parallel** | Khi task độc lập nhau, spawn 5 subagent chạy song song thay vì nối tiếp — giảm 70% thời gian scaffolding |
| **Review mọi file sinh ra** | Đọc từng file AI viết, audit logic, sửa trực tiếp — không accept blindly |
| **Build → Test → Fix loop** | Sau mỗi nhóm thay đổi, chạy `tsc --noEmit` + `jest`; nếu fail, feed lỗi lại cho AI fix chính xác |
| **Memory persistence** | Dùng auto-memory feature của Claude Code để giữ context dự án xuyên qua nhiều session |

---

## 2. Timeline & Giai đoạn

### Phase 1 — Context & Spec Writing (trước khi sinh code)

**Prompt 1:**
> "Thiết kế 1 hệ thống chấm công Zero-Touch: employee không cần bấm nút, app tự động check-in khi đến chi nhánh (xác minh WiFi BSSID + GPS + anti-fraud). Quy mô 100 branch, 5000 NV. Đề xuất tech stack, DB schema, API, và các điểm cần lưu ý cho mobile background scheduler trên iOS/Android."

**Kết quả:**
- Tech stack: NestJS + PostgreSQL + Redis + React Native + React PWA
- Phát hiện edge case: iOS BGTask không đảm bảo thời gian → phải kết hợp `CLCircularRegion` geofence + `significantLocationChanges`
- Quyết định: partition `attendance_records` theo tháng khi dữ liệu > 1M rows

**Prompt 2:**
> "Viết CLAUDE.md với đầy đủ rules: naming convention, SOLID, clean architecture, API design, fraud detection flow (9 bước), mobile background flow Android/iOS, scale strategy, security rules, code style. Đây sẽ là source-of-truth cho tất cả AI session sau."

**Kết quả:** File CLAUDE.md ~22KB, 10 sections, là base context cho mọi session sau. Đây là bước quan trọng nhất — mọi quyết định kiến trúc được ghi lại thành rule.

### Phase 2 — Design System

**Prompt 3:**
> "Tạo DESIGN_SYSTEM.md thống nhất cho mobile + web: màu primary teal (#49B7C3), typography Inter/JetBrains Mono, component library (button/input/badge/card), 5 status states, responsive breakpoints, dark mode tokens. Ưu tiên accessibility WCAG AA."

**Kết quả:** 25KB design tokens + 60+ component specs. Sau này khi generate UI, AI chỉ cần tham khảo DESIGN_SYSTEM.md thay vì improvise style.

### Phase 3 — Workflow Docs (7 files)

**Prompt 4:**
> "Trong folder docs/, tạo 7 tài liệu workflow: AUTH_FLOW.md (JWT + device session), DATABASE_SCHEMA.md (ERD + partitioning), ENV_TEMPLATE.md, NOTIFICATION_TEMPLATES.md (Telegram/Zalo), OFFLINE_SYNC_PROTOCOL.md (idempotency key), TEST_CASES.md (85 test cases), WEBSOCKET_EVENTS.md (6 event types)."

**Kết quả:** Mỗi tài liệu 300-600 lines. TEST_CASES.md sau này dùng trực tiếp làm unit test spec.

### Phase 4 — Parallel Code Generation (5 AI agents song song)

**Prompt 5 (Orchestrator):**
> "Đóng vai Senior Architect. Dựa trên CLAUDE.md + DESIGN_SYSTEM.md + docs/, scaffold TOÀN BỘ dự án: backend NestJS (10 modules), web React PWA (6 pages), Docker compose, CI/CD, migrations, unit tests. Chia work thành 5 agent song song để tối đa tốc độ."

**Sub-agents:**
1. **Agent A** — Backend structure: package.json, tsconfig, main.ts, config/, common/ (guards, interceptors, filters, utils)
2. **Agent B** — Backend modules: auth, branch, employee, schedule (+ entities, DTOs, services, controllers)
3. **Agent C** — Backend modules: attendance (9-step flow), fraud, sync, notification, realtime, health
4. **Agent D** — Infrastructure: Dockerfiles, docker-compose x2, Nginx config, .github/workflows/ci.yml
5. **Agent E** — Web PWA: all 7 pages, components (StatusBadge, StatsCard, layout), stores (auth, attendance), hooks (useAttendanceWebSocket)

**Kết quả:** 145 files sinh ra trong 1 session. Tiết kiệm đáng kể thời gian nhờ song song.

### Phase 5 — Audit & Fix Loop

**Prompt 6:**
> "audit lại xem đủ hết chưa?"

Claude tự chạy gap analysis và phát hiện các lỗi quan trọng:

| Vấn đề AI tìm ra | Fix |
|---|---|
| 2 bộ migrations conflict (monolithic + individual) | Xoá `1700000000000-InitialSchema.ts` |
| Attendance controller thiếu `GET /export` CSV | Thêm `exportCsv()` + endpoint |
| `DELETE /auth/device` chỉ reset device của chính user đang login | Thêm `ResetDeviceDto { employee_id }` cho admin reset device NV khác |
| RealtimeGateway thiếu JWT auth, auto-join room, Redis relay, `stats:update` cron | Rewrite hoàn toàn gateway (+ ws-auth logic) |

### Phase 6 — Build/Test/Fix Loop (vòng lặp tự động)

**Prompt 7:**
> "run backend + test pass hết yêu cầu, nếu fail tự fix, tạo thành 1 vòng lặp cho tới khi hoàn chỉnh"

Loop thực tế chạy:

1. `npm install` (backend) → ✅ 732 packages
2. `tsc --noEmit` → ❌ 8 errors (validation.pipe có option `transform` sai, auth.spec DTO thiếu field `device_model`, `os_version`) → **Fixed**
3. `tsc --noEmit` → ✅
4. `jest` → ❌ 5 test fails (timezone math sai, `TIMESTAMP_ON_TIME` trong attendance.spec thực ra là 08:02, không phải 08:00) → **Fixed time-window.ts dùng `Intl.DateTimeFormat` và sửa fixture**
5. `jest` → ✅ **72/72 pass**
6. `npm install` (web) + `tsc --noEmit` → ❌ 7 errors (missing `vite-env.d.ts`, unused vars, SortHeader onClick signature mismatch) → **Fixed**
7. `vite build` → ✅ 9 chunks, PWA service worker generated

**Self-correcting loop này là trải nghiệm quan trọng nhất** — AI không chỉ sinh code mà còn biết test + fix cho đến khi pass.

### Phase 7 — Demo & Polish (quay video cho client review)

**Prompt 8:**
> "fix hết các bugs trên mobile sau đó sử dụng mcp chạy toàn bộ các tính năng quay video lại cho tôi y như portal."

Loop thực tế chạy:

1. Audit mobile bugs: phát hiện `Invalid Date` trên clock (Hermes không parse được `new Date().toLocaleString('en-US', {timeZone})`) + UTC time hiển thị thay vì VN time → **Fix** bằng `Intl.DateTimeFormat.formatToParts` với `timeZone: 'Asia/Ho_Chi_Minh'`
2. Thử `adb shell screenrecord` → ❌ `Encoder failed (err=-38)` (MediaCodec broken trên Apple Silicon arm64 emulator)
3. Thử `scrcpy --record` → ❌ `IllegalStateException` trong SurfaceEncoder (cùng root cause)
4. **Workaround**: background loop `adb exec-out screencap -p` bắn PNG vào temp dir, rồi ffmpeg stitch lại ở 2fps → ✅
5. Orchestrate UI bằng `adb input tap/swipe` với toạ độ đã calibrate cho màn 1080×2280

**Bài học**: khi native tool fail trên emulator non-x86, fallback sang frame-capture loop là reliable nhất. Toạ độ tap calibrate thủ công (tap thử → đọc log → chỉnh) tốn thời gian nhưng chính xác hơn selector-based automation vì RN không expose accessibility tree qua adb.

**Prompt 9:**
> "quay lại video portal giúp tôi thiếu phần của tab phát hiện gian lận"

AI quên cover 1 route (`/fraud` — `FraudLogsPage`) trong script Playwright. Fix:
- Grep tìm route: `a[href="/fraud"]`, label "Phát hiện gian lận"
- Thêm section 6½ vào `scripts/record-portal-demo.mjs`: navigate → scroll → mở severity filter → click row đầu để mở detail modal → đóng
- Re-run → video mới 5.0MB, đầy đủ 7 tab

**Bài học**: khi auto-generate demo script, luôn đối chiếu với sidebar/router config thay vì liệt kê từ trí nhớ. AI bỏ sót là bình thường — cần 1 pass verify thủ công.

**Prompt 10:**
> "update lại design mobile tôi thấy nhiều text nó cứ bị gray ko black nhìn không rõ, ngoài ra tôi muốn quay video trong đó có click checkout chứ ko phải checkin,checkout sẵn"

Feedback 2 vấn đề đồng thời — UX + realism của demo:

| Vấn đề | Fix |
|---|---|
| Text xám quá nhạt, contrast yếu | `#9ca3af` → `#4b5563`, `#6b7280` → `#374151`, `timeChip`/`rateLabel` → `#111` (replace_all từng file) |
| Demo video có cả 2 ô check-in/check-out đã pre-seeded, không thấy user action | Pre-script: DELETE today's records, INSERT chỉ 1 check-in (không check-out) → tap CHECK OUT Y=1490 trong video → user thấy spinner + kết quả |

**Bài học**: demo video tốt phải show **interaction**, không phải chỉ show **state**. Pre-seed dữ liệu sao cho user phải tự tap vào button chính — đó mới là thứ stakeholder muốn thấy. Color contrast thì đừng tin mắt mình trên monitor văn phòng — nhân viên dùng ngoài nắng sẽ thấy khác.

---

## 3. Review Process

Đối với code AI sinh ra, quy trình review:

1. **Đọc hiểu logic** — không accept nếu chưa hiểu tại sao AI viết như vậy
2. **Check CLAUDE.md compliance** — tên file kebab-case, class PascalCase, method camelCase, snake_case cho DB
3. **Check security** — không có `raw SQL`, không có `any`, mọi input validate bằng class-validator
4. **Check SOLID** — mỗi service 1 trách nhiệm; controller không query DB trực tiếp
5. **Chạy test** — unit test trước khi commit; nếu test fail, investigate + fix thay vì skip

**Example sửa chữa nhân văn:**
- AI viết `validation.pipe.ts` với option `transform: true` (sai với class-validator API) → tôi đọc và xoá
- AI viết `parseScheduleDateTime` với logic timezone lộn xộn → tôi rewrite dùng `Intl.DateTimeFormat('sv-SE')` — đơn giản và đúng
- AI để `TIMESTAMP_ON_TIME = '01:02:00Z'` (= 08:02 VN, 2 min late) nhưng test expect ON_TIME → tôi sửa thành `01:00:00Z` (đúng 08:00 VN)

---

## 4. Metrics

| Chỉ số | Giá trị |
|---|---|
| Tổng file source code (TS/TSX) | 85 backend + 20 web = 105 |
| Test coverage | 72 unit tests pass, 8 test suites |
| Unit test thời gian | 5.8s (full suite) |
| Backend build | `tsc` + `nest build` pass trong <10s |
| Web build | `vite build` pass trong 2.7s, 9 chunks |
| AI sessions | ~5 sessions, mỗi session 1-2 tiếng |
| Code AI viết vs human-written | 95% AI / 5% human edits (mostly fixes) |
| Prompts chính | ~18 prompt lớn + ~45 fix/audit prompts |
| Demo artifacts | `portal-demo.mp4` (1.4MB, 7 tab) + `mobile-demo.mp4` (406KB, click flow) |

---

## 5. Bài học rút ra

### ✅ Những gì work tốt

1. **Context file (CLAUDE.md) is king** — prompt càng ngắn càng tốt khi context file đủ dày; rule trong CLAUDE.md compound hiệu ứng qua nhiều session
2. **Parallel subagents** cho task độc lập — scaffolding 145 files trong 15 phút thay vì 2 tiếng sequential
3. **Self-correcting loop** — yêu cầu AI "chạy test, nếu fail tự fix" làm được thực sự: AI đọc stack trace → locate file → sửa → retest
4. **Memory persistence** — auto-memory giữ bối cảnh dự án xuyên session, khỏi phải re-prime context mỗi lần
5. **Review mọi file** — phát hiện bug tinh vi (timezone math, enum conflict, DTO field missing) mà AI không tự catch được trong lần đầu

### ⚠️ Những chỗ cần thận trọng

1. **AI đôi khi "tự tin" với logic sai** — timezone handling ban đầu phức tạp và sai; cần human catch
2. **Edit tool template-literal** — khi new_string chứa `` ` `` (backticks), Edit có thể cắt ngang, file bị corrupt → phải `Write` lại file hoàn chỉnh
3. **AI dễ quên constraints** — sau khi sửa code, không tự động chạy lại test nếu không được nhắc; cần loop prompt rõ ràng
4. **Fixture/test discrepancy** — AI viết test với timestamp "8:02" nhưng expect ON_TIME (sai, phải là LATE); đọc từng assertion mới thấy

### 💡 Khuyến nghị cho team

- Viết CLAUDE.md / Cursor rules / Copilot instructions NGAY LẬP TỨC khi bắt đầu dự án mới
- Dùng subagent parallel cho task scaffolding, không dùng cho task cần shared state
- Luôn kết thúc bằng loop `build → test → fix` trước khi claim "done"
- Review 100% code AI sinh, dù chỉ là comment — dễ lỡ bug tinh vi
- Khi AI sửa nhiều lần vẫn sai, dừng lại và đọc code thủ công — có thể vấn đề ở ngữ cảnh AI chưa biết

---

## 6. Tham khảo nhanh

- `CLAUDE.md` — context file
- `DESIGN_SYSTEM.md` — design tokens
- `docs/` — 7 workflow specs
- `backend/test/unit/` — 8 test suites (72 tests)
- `web/src/` — 7 pages + components + hooks
- `.github/workflows/ci.yml` — CI tự chạy backend + web test
