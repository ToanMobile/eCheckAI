import React, { useEffect, useState } from 'react';
import {
  Alert, SafeAreaView, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';
import { fetchMySchedule, normalizeSchedule, ScheduleDetail } from '../api/attendanceApi';
import { loadQueue, flush } from '../services/OfflineQueueManager';

const DAY_NAMES = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function ProfileScreen(): JSX.Element {
  const { user, branch, logout } = useAuthStore();
  const [schedule, setSchedule] = useState<ScheduleDetail | null>(null);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    void loadInfo();
  }, []);

  async function loadInfo(): Promise<void> {
    const q = await loadQueue();
    setQueueSize(q.length);
    try {
      const sched = await fetchMySchedule();
      setSchedule(sched);
      await AsyncStorage.setItem('sa:cached_schedule', JSON.stringify(sched));
    } catch { /* schedule optional */ }
  }

  async function onFlushQueue(): Promise<void> {
    const employeeId = user?.id ?? '';
    if (!employeeId) return;
    const res = await flush(employeeId);
    Alert.alert(
      'Đồng bộ offline queue',
      `Đã xử lý: ${res.processed}\nLỗi: ${res.failed}\nCòn lại: ${res.remaining}`,
    );
    void loadInfo();
  }

  async function onLogout(): Promise<void> {
    Alert.alert('Đăng xuất', 'Bạn có chắc muốn đăng xuất?', [
      { text: 'Hủy', style: 'cancel' },
      { text: 'Đăng xuất', style: 'destructive', onPress: () => void logout() },
    ]);
  }

  const norm = schedule ? normalizeSchedule(schedule) : null;
  const activeDays = norm?.activeDays ?? norm?.active_days ?? [];
  const activeDayLabels = activeDays.length
    ? [...activeDays].sort((a, b) => a - b).map(d => DAY_NAMES[d] ?? '').join(', ')
    : '—';

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.body}>
        {/* Avatar */}
        <View style={s.avatarSection}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{(user?.fullName ?? '?')[0]?.toUpperCase()}</Text>
          </View>
          <Text style={s.name}>{user?.fullName ?? '—'}</Text>
          <Text style={s.email}>{user?.email ?? '—'}</Text>
          <View style={s.roleBadge}>
            <Text style={s.roleTxt}>{user?.role === 'super_admin' ? 'Super Admin' : user?.role === 'hr' ? 'HR' : user?.role === 'branch_manager' ? 'Quản lý' : 'Nhân viên'}</Text>
          </View>
        </View>

        {/* Chi nhánh */}
        <SectionCard title="CHI NHÁNH">
          <InfoRow icon="🏢" label="Tên" value={branch?.name ?? 'Chưa gán'} />
          <InfoRow icon="📡" label="WiFi BSSID" value={branch?.wifi_bssids?.join(', ') ?? '—'} mono />
          <InfoRow icon="📍" label="Bán kính" value={branch ? `${branch.radius}m` : '—'} />
        </SectionCard>

        {/* Lịch làm việc */}
        <SectionCard title="LỊCH LÀM VIỆC">
          <InfoRow icon="🟢" label="Giờ vào" value={(norm?.checkin_time ?? norm?.checkinTime ?? '—').slice(0, 5)} mono />
          <InfoRow icon="🔴" label="Giờ ra" value={(norm?.checkout_time ?? norm?.checkoutTime ?? '—').slice(0, 5)} mono />
          <InfoRow icon="⏱" label="Khung giờ" value={norm ? `±${norm.window_minutes ?? norm.windowMinutes} phút` : '—'} />
          <InfoRow icon="📆" label="Ngày làm việc" value={activeDayLabels} />
        </SectionCard>

        {/* Thiết bị */}
        <SectionCard title="THIẾT BỊ & SYNC">
          <InfoRow icon="📱" label="Offline queue" value={`${queueSize} bản ghi`} />
        </SectionCard>

        {/* Actions */}
        <TouchableOpacity style={s.actionBtn} onPress={() => void loadInfo()}>
          <Text style={s.actionBtnIcon}>🔄</Text>
          <Text style={s.actionBtnTxt}>Đồng bộ lịch làm việc</Text>
        </TouchableOpacity>

        {queueSize > 0 && (
          <TouchableOpacity style={[s.actionBtn, { borderColor: '#f59e0b' }]} onPress={onFlushQueue}>
            <Text style={s.actionBtnIcon}>📤</Text>
            <Text style={[s.actionBtnTxt, { color: '#d97706' }]}>Flush offline queue ({queueSize})</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[s.actionBtn, s.logoutBtn]} onPress={onLogout}>
          <Text style={s.actionBtnIcon}>🚪</Text>
          <Text style={[s.actionBtnTxt, { color: '#ef4444' }]}>Đăng xuất</Text>
        </TouchableOpacity>

        <Text style={s.version}>FinOS eCheckAI v2.0 · HDBank</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <View style={s.sectionCard}>
      <Text style={s.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ icon, label, value, mono = false }: {
  icon: string; label: string; value: string; mono?: boolean;
}): JSX.Element {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoIcon}>{icon}</Text>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={[s.infoValue, mono && s.infoMono]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const TEAL = '#49B7C3';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f7f9' },
  body: { padding: 20, paddingBottom: 40 },

  avatarSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: TEAL,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
    elevation: 4, shadowColor: TEAL, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6,
  },
  avatarText: { fontSize: 28, color: '#fff', fontWeight: '700' },
  name: { fontSize: 20, fontWeight: '800', color: '#111' },
  email: { fontSize: 13, color: '#374151', marginTop: 2 },
  roleBadge: {
    marginTop: 8, backgroundColor: TEAL + '20',
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20,
  },
  roleTxt: { color: TEAL, fontSize: 12, fontWeight: '700' },

  sectionCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 14,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#4b5563',
    letterSpacing: 0.8, marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderColor: '#f9fafb',
  },
  infoIcon: { fontSize: 16, width: 26 },
  infoLabel: { fontSize: 13, color: '#374151', width: 110 },
  infoValue: { flex: 1, fontSize: 13, color: '#111', fontWeight: '600', textAlign: 'right' },
  infoMono: { fontVariant: ['tabular-nums'], fontSize: 12 },

  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 10, borderWidth: 1.5, borderColor: '#e5e7eb',
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3,
  },
  logoutBtn: { borderColor: '#fecaca' },
  actionBtnIcon: { fontSize: 18 },
  actionBtnTxt: { fontSize: 15, fontWeight: '600', color: TEAL },

  version: { textAlign: 'center', color: '#6b7280', fontSize: 12, marginTop: 16 },
});
