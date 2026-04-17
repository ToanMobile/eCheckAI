#!/usr/bin/env bash
# Orchestrates the mobile demo. Captures frames via `adb exec-out screencap -p`
# into a temp dir, then stitches them into an MP4 with ffmpeg.
# Output: /Volumes/Data/GalaxyHolding/HDBankConnect/mobile-demo.mp4
set -euo pipefail

DEV="emulator-5554"
PKG="com.smartattendancemobile"
ROOT="/Volumes/Data/GalaxyHolding/HDBankConnect"
OUT_MP4="${ROOT}/mobile-demo.mp4"
FRAME_DIR="${ROOT}/_mobile_frames"
FPS=6   # capture target

EMP_ID="62d7f105-13e4-40d8-a741-25a1286157de"     # nv00489@hdbank.vn
BRANCH_ID="769abbf3-b900-479c-8f6b-90c67060e0a5"
PG="PGPASSWORD=smartattend2025 psql -h localhost -p 5432 -U postgres -d smart_attendance"

# ── Prep DB: chỉ giữ 1 bản ghi check-in (chưa check-out) cho hôm nay ─────
eval "$PG -c \"DELETE FROM attendance_records WHERE employee_id='$EMP_ID' AND work_date=CURRENT_DATE;\"" >/dev/null
eval "$PG -c \"INSERT INTO attendance_records (employee_id, branch_id, type, status, check_in, work_date, location_snapshot, device_snapshot) VALUES ('$EMP_ID', '$BRANCH_ID', 'auto_checkin', 'on_time', (CURRENT_DATE || ' 08:02:00+07')::timestamptz, CURRENT_DATE, '{}'::jsonb, '{}'::jsonb);\"" >/dev/null

rm -rf "$FRAME_DIR"; mkdir -p "$FRAME_DIR"

# Reset app state, grant perms
adb -s "$DEV" shell am force-stop "$PKG"
adb -s "$DEV" shell pm clear "$PKG" >/dev/null
adb -s "$DEV" shell pm grant "$PKG" android.permission.ACCESS_FINE_LOCATION || true
adb -s "$DEV" shell pm grant "$PKG" android.permission.ACCESS_COARSE_LOCATION || true

# ── Background capture loop ──────────────────────────────────────────────
capture_loop() {
  local i=0
  local interval="0.166"   # ≈ 6 fps
  while [ -f /tmp/mobile-rec.flag ]; do
    adb -s "$DEV" exec-out screencap -p > "$FRAME_DIR/$(printf '%06d' $i).png" 2>/dev/null || true
    i=$((i+1))
    sleep $interval
  done
}
touch /tmp/mobile-rec.flag
capture_loop &
CAP_PID=$!
sleep 1

tap()   { adb -s "$DEV" shell input tap "$1" "$2"; sleep "${3:-1.2}"; }
swipe() { adb -s "$DEV" shell input swipe "$1" "$2" "$3" "$4" "${5:-400}"; sleep 1; }
keyev() { adb -s "$DEV" shell input keyevent "$1"; sleep 0.6; }
w()     { sleep "$1"; }

# ── 1. Launch app ─────────────────────────────────────────────────────────
adb -s "$DEV" shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
w 7

# ── 2. Login (creds pre-filled) ───────────────────────────────────────────
w 2
tap 540 1555 7      # Đăng nhập

# ── 3. Home: hiển thị clock + status (Đã check-in 08:02) ──────────────────
w 5

# ── 4. TAP CHECK OUT → xem spinner + kết quả điều kiện ────────────────────
tap 540 1490 2      # button CHECK OUT
w 8                 # condition check + animation

# ── 5. History tab ────────────────────────────────────────────────────────
tap 405 2070 3
tap 405 655 2       # Chờ duyệt
tap 675 655 2       # Trễ
tap 135 655 2       # Tất cả
w 1

# ── 6. Report tab + scroll ────────────────────────────────────────────────
tap 675 2070 4
swipe 540 1800 540 700 500
w 2

# ── 7. Profile tab + scroll ───────────────────────────────────────────────
tap 945 2070 4
swipe 540 1800 540 700 500
w 3

# ── 8. Back to Home, mở Manual Check-in ───────────────────────────────────
tap 135 2070 2
swipe 540 600 540 1400 400
w 1
tap 540 1680 4      # CHẤM CÔNG BÙ
w 3
keyev KEYCODE_BACK
w 2

# ── Stop capture ──────────────────────────────────────────────────────────
rm -f /tmp/mobile-rec.flag
wait $CAP_PID 2>/dev/null || true

FRAMES=$(ls "$FRAME_DIR" | wc -l | tr -d ' ')
echo "Captured $FRAMES frames"

find "$FRAME_DIR" -type f -size 0 -delete

ffmpeg -y -framerate $FPS -pattern_type glob -i "$FRAME_DIR/*.png" \
  -vf "scale=540:-2,format=yuv420p" \
  -c:v libx264 -preset veryfast -crf 23 \
  -movflags +faststart \
  "$OUT_MP4" 2>&1 | tail -5

ls -lh "$OUT_MP4"
