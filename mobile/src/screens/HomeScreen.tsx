import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, SafeAreaView,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { fetchTodayAttendance, AttendanceRecord } from '../api/attendanceApi';
import { executeAutoCheckin } from '../services/AutoCheckinExecutor';
import type { BranchConfig } from '../services/ConditionChecker';
import ManualCheckinSheet from './ManualCheckinSheet';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TZ = 'Asia/Ho_Chi_Minh';

function nowVN(): Date {
  return new Date();
}

function fmtTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function fmtDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  }).formatToParts(date);
  const get = (t: string): string => parts.find(p => p.type === t)?.value ?? '';
  const weekdayMap: Record<string, string> = {
    Mon: 'Thứ 2', Tue: 'Thứ 3', Wed: 'Thứ 4', Thu: 'Thứ 5',
    Fri: 'Thứ 6', Sat: 'Thứ 7', Sun: 'Chủ nhật',
  };
  const wd = weekdayMap[get('weekday')] ?? get('weekday');
  return `${wd}, ${get('day')}/${get('month')}/${get('year')}`;
}

function fmtIso(iso: string | null): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

const FAILURE_LABELS: Record<string, string> = {
  WIFI_MISMATCH: '📶 WiFi không khớp',
  OUTSIDE_GEOFENCE: '📍 Ngoài vùng chi nhánh',
  GPS_INACCURATE: '📡 GPS không đủ chính xác',
  GPS_UNAVAILABLE: '📡 Không lấy được GPS',
  VPN_DETECTED: '🔒 Đang dùng VPN',
  MOCK_LOCATION_DETECTED: '🚫 Phát hiện giả vị trí',
  MOCK_LOCATION_NATIVE: '🚫 Mock location bật',
  DEVICE_FARMING_SUSPECTED: '⚠️ Thiết bị chưa mở khoá',
  LOCATION_PERMISSION_DENIED: '🔐 Chưa cấp quyền vị trí',
  SERVER_REJECTED_401: '🔑 Phiên đăng nhập hết hạn',
  SERVER_REJECTED_409: '⚠️ Đã chấm công rồi',
  NETWORK_ERROR_QUEUED: '📭 Mạng lỗi — đã lưu hàng đợi',
};

type ResultState =
  | { kind: 'idle' }
  | { kind: 'loading'; label: string }
  | { kind: 'success'; label: string; detail: string; color: string }
  | { kind: 'fail'; reasons: string[] };

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen(): JSX.Element {
  const { user, branch } = useAuthStore();
  const [clock, setClock] = useState(nowVN());
  const [today, setToday] = useState<AttendanceRecord | null>(null);
  const [loadingToday, setLoadingToday] = useState(true);
  const [result, setResult] = useState<ResultState>({ kind: 'idle' });
  const [showBu, setShowBu] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live clock
  useEffect(() => {
    timerRef.current = setInterval(() => setClock(nowVN()), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const loadToday = useCallback(async () => {
    setLoadingToday(true);
    try {
      const rec = await fetchTodayAttendance();
      setToday(rec);
    } finally {
      setLoadingToday(false);
    }
  }, []);

  useEffect(() => { void loadToday(); }, [loadToday]);

  async function onCheckin(kind: 'auto_checkin' | 'auto_checkout'): Promise<void> {
    if (!branch) {
      setResult({ kind: 'fail', reasons: ['Chưa có thông tin chi nhánh. Vui lòng đăng xuất và đăng nhập lại.'] });
      return;
    }
    if (!user) return;

    const label = kind === 'auto_checkin' ? 'Đang check-in...' : 'Đang check-out...';
    setResult({ kind: 'loading', label });

    const branchCfg: BranchConfig = {
      lat: branch.lat,
      lng: branch.lng,
      radius: branch.radius,
      wifi_bssids: branch.wifi_bssids,
    };

    const res = await executeAutoCheckin(kind, user.id, branchCfg);

    if (res.success) {
      const verb = kind === 'auto_checkin' ? 'Check-in' : 'Check-out';
      const now = fmtTime(nowVN());
      setResult({
        kind: 'success',
        label: `✅ ${verb} thành công lúc ${now}`,
        detail: res.branchName ? `Chi nhánh: ${res.branchName}` : '',
        color: '#10b981',
      });
      void loadToday();
    } else if (res.queued) {
      setResult({
        kind: 'success',
        label: '📭 Đã lưu hàng đợi (mạng lỗi)',
        detail: 'Sẽ tự đồng bộ khi có mạng',
        color: '#f59e0b',
      });
    } else {
      const reasons = (res.reason ?? '').split(',').map(r => FAILURE_LABELS[r] ?? r).filter(Boolean);
      setResult({ kind: 'fail', reasons: reasons.length ? reasons : ['Không xác định được lý do'] });
    }
  }

  const checkedIn = today?.check_in != null;
  const checkedOut = today?.check_out != null;

  const statusColor: Record<string, string> = {
    on_time: '#10b981', late: '#f59e0b', absent: '#ef4444',
    early_leave: '#f59e0b', pending: '#6366f1', manual: '#6366f1',
  };
  const statusLabel: Record<string, string> = {
    on_time: 'Đúng giờ ✅', late: 'Trễ 🟡', absent: 'Vắng ❌',
    early_leave: 'Về sớm 🟡', pending: 'Chờ duyệt ⏳', manual: 'Thủ công 📝',
  };

  return (
    <SafeAreaView style={s.root}>
      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={loadingToday} onRefresh={loadToday} />}
      >
        {/* Greeting */}
        <View style={s.greetRow}>
          <View>
            <Text style={s.greetSub}>Xin chào,</Text>
            <Text style={s.greetName} numberOfLines={1}>{user?.fullName ?? '—'}</Text>
          </View>
          <View style={s.branchBadge}>
            <Text style={s.branchText} numberOfLines={1}>{branch?.name ?? 'Chưa có chi nhánh'}</Text>
          </View>
        </View>

        {/* Clock */}
        <View style={s.clockBox}>
          <Text style={s.clockTime}>{fmtTime(clock)}</Text>
          <Text style={s.clockDate}>{fmtDate(clock)}</Text>
        </View>

        {/* Today status card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>TRẠNG THÁI HÔM NAY</Text>
          {loadingToday
            ? <ActivityIndicator color={TEAL} style={{ marginTop: 12 }} />
            : (
              <View style={s.statusRow}>
                <StatusItem label="Check-in" value={fmtIso(today?.check_in ?? null)} ok={checkedIn} />
                <View style={s.divider} />
                <StatusItem label="Check-out" value={fmtIso(today?.check_out ?? null)} ok={checkedOut} />
                <View style={s.divider} />
                <View style={s.statusItem}>
                  <Text style={s.statusLabel}>Trạng thái</Text>
                  <Text style={[s.statusVal, { color: statusColor[today?.status ?? ''] ?? '#9ca3af' }]}>
                    {today ? (statusLabel[today.status] ?? today.status) : '—'}
                  </Text>
                </View>
              </View>
            )}
        </View>

        {/* Action buttons */}
        <TouchableOpacity
          style={[s.btn, s.btnCheckin, (checkedIn || result.kind === 'loading') && s.btnOff]}
          onPress={() => void onCheckin('auto_checkin')}
          disabled={checkedIn || result.kind === 'loading'}
          activeOpacity={0.85}
        >
          <Text style={s.btnIcon}>🟢</Text>
          <Text style={s.btnText}>CHECK IN</Text>
          {checkedIn && <Text style={s.btnNote}>Đã check-in</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btn, s.btnCheckout, (!checkedIn || checkedOut || result.kind === 'loading') && s.btnOff]}
          onPress={() => void onCheckin('auto_checkout')}
          disabled={!checkedIn || checkedOut || result.kind === 'loading'}
          activeOpacity={0.85}
        >
          <Text style={s.btnIcon}>🔴</Text>
          <Text style={s.btnText}>CHECK OUT</Text>
          {checkedOut && <Text style={s.btnNote}>Đã check-out</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.btn, s.btnManual]}
          onPress={() => setShowBu(true)}
          activeOpacity={0.85}
        >
          <Text style={s.btnIcon}>📝</Text>
          <Text style={s.btnText}>CHẤM CÔNG BÙ</Text>
        </TouchableOpacity>

        {/* Result panel */}
        {result.kind === 'loading' && (
          <View style={[s.resultBox, { backgroundColor: '#f3f4f6' }]}>
            <ActivityIndicator color={TEAL} />
            <Text style={[s.resultText, { marginLeft: 10 }]}>{result.label}</Text>
          </View>
        )}
        {result.kind === 'success' && (
          <View style={[s.resultBox, { backgroundColor: result.color + '15', borderColor: result.color }]}>
            <Text style={[s.resultText, { color: result.color, fontWeight: '700' }]}>{result.label}</Text>
            {!!result.detail && <Text style={[s.resultSub, { color: result.color }]}>{result.detail}</Text>}
          </View>
        )}
        {result.kind === 'fail' && (
          <View style={[s.resultBox, { backgroundColor: '#fef2f2', borderColor: '#ef4444' }]}>
            <Text style={[s.resultText, { color: '#ef4444', fontWeight: '700', marginBottom: 6 }]}>
              ❌ Không thể chấm công
            </Text>
            {result.reasons.map((r, i) => (
              <Text key={i} style={s.failReason}>{r}</Text>
            ))}
          </View>
        )}
      </ScrollView>

      <ManualCheckinSheet
        visible={showBu}
        onClose={() => setShowBu(false)}
        onSuccess={() => { setShowBu(false); void loadToday(); }}
      />
    </SafeAreaView>
  );
}

function StatusItem({ label, value, ok }: { label: string; value: string; ok: boolean }): JSX.Element {
  return (
    <View style={s.statusItem}>
      <Text style={s.statusLabel}>{label}</Text>
      <Text style={[s.statusVal, { color: ok ? '#10b981' : '#9ca3af' }]}>{value}</Text>
    </View>
  );
}

const TEAL = '#49B7C3';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f7f9' },
  scroll: { padding: 20, paddingBottom: 40 },

  greetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greetSub: { fontSize: 13, color: '#374151' },
  greetName: { fontSize: 20, fontWeight: '800', color: '#111', maxWidth: 200 },
  branchBadge: { backgroundColor: TEAL + '20', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, maxWidth: 140 },
  branchText: { color: TEAL, fontSize: 12, fontWeight: '700' },

  clockBox: {
    backgroundColor: '#fff', borderRadius: 16, padding: 24,
    alignItems: 'center', marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  clockTime: { fontSize: 52, fontWeight: '200', color: '#111', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  clockDate: { marginTop: 4, fontSize: 14, color: '#374151', fontWeight: '500' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 16,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4,
  },
  cardTitle: { fontSize: 11, fontWeight: '700', color: '#4b5563', letterSpacing: 0.8, marginBottom: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statusItem: { flex: 1, alignItems: 'center' },
  statusLabel: { fontSize: 12, color: '#4b5563', marginBottom: 4 },
  statusVal: { fontSize: 15, fontWeight: '700' },
  divider: { width: 1, backgroundColor: '#e5e7eb' },

  btn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, paddingVertical: 16, marginBottom: 12, gap: 8,
    elevation: 3, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4,
  },
  btnCheckin: { backgroundColor: '#10b981', shadowColor: '#10b981' },
  btnCheckout: { backgroundColor: '#ef4444', shadowColor: '#ef4444' },
  btnManual: { backgroundColor: '#6366f1', shadowColor: '#6366f1' },
  btnOff: { opacity: 0.4, elevation: 0 },
  btnIcon: { fontSize: 18 },
  btnText: { color: '#fff', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  btnNote: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginLeft: 4 },

  resultBox: {
    borderRadius: 12, padding: 16, borderWidth: 1.5,
    borderColor: '#e5e7eb', flexDirection: 'column', marginTop: 4,
  },
  resultText: { fontSize: 15, color: '#374151' },
  resultSub: { fontSize: 13, marginTop: 4 },
  failReason: { fontSize: 13, color: '#991b1b', marginTop: 4, paddingLeft: 4 },
});
