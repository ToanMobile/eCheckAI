import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl,
  SafeAreaView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { fetchMyAttendance, AttendanceRecord } from '../api/attendanceApi';

type TabKey = 'all' | 'pending' | 'late' | 'absent';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'late', label: 'Trễ' },
  { key: 'absent', label: 'Vắng' },
];

const STATUS_COLOR: Record<string, string> = {
  on_time: '#10b981', late: '#f59e0b', absent: '#ef4444',
  early_leave: '#f59e0b', pending: '#6366f1', manual: '#6366f1',
};
const STATUS_LABEL: Record<string, string> = {
  on_time: 'Đúng giờ', late: 'Trễ', absent: 'Vắng',
  early_leave: 'Về sớm', pending: 'Chờ duyệt', manual: 'Thủ công',
};
const TYPE_ICON: Record<string, string> = {
  auto_checkin: '🤖', auto_checkout: '🤖', manual: '✍️',
};

function monthBounds(year: number, month: number): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay)}` };
}

function fmtTime(iso: string | null): string {
  if (!iso) return '--:--';
  return new Date(iso).toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function fmtWorkDate(iso: string): string {
  const [, m, d] = iso.split('-');
  const dow = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const day = dow[new Date(iso).getDay()] ?? '';
  return `${day} ${d}/${m}`;
}

export default function AttendanceHistoryScreen(): JSX.Element {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState<TabKey>('all');
  const [rows, setRows] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = monthBounds(year, month);
      const res = await fetchMyAttendance({ date_from: from, date_to: to, limit: 100 });
      setRows(res.items);
      setPendingCount(res.items.filter(r => r.status === 'pending').length);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => { void load(); }, [load]);

  function navigate(dir: -1 | 1): void {
    let m = month + dir;
    let y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m);
    setYear(y);
  }

  const filtered = rows.filter(r => {
    if (tab === 'pending') return r.status === 'pending' || r.type === 'manual';
    if (tab === 'late') return r.status === 'late';
    if (tab === 'absent') return r.status === 'absent';
    return true;
  });

  // Summary
  const present = rows.filter(r => r.check_in).length;
  const late = rows.filter(r => r.status === 'late').length;
  const absent = rows.filter(r => r.status === 'absent').length;

  return (
    <SafeAreaView style={s.root}>
      {/* Month nav */}
      <View style={s.monthNav}>
        <TouchableOpacity onPress={() => navigate(-1)} style={s.navBtn}>
          <Text style={s.navArrow}>◀</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>
          Tháng {String(month).padStart(2, '0')}/{year}
        </Text>
        <TouchableOpacity
          onPress={() => navigate(1)}
          style={s.navBtn}
          disabled={year === now.getFullYear() && month === now.getMonth() + 1}
        >
          <Text style={[
            s.navArrow,
            year === now.getFullYear() && month === now.getMonth() + 1 && { opacity: 0.3 },
          ]}>▶</Text>
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      <View style={s.summaryBar}>
        <SumItem label="Đi làm" value={present} color="#10b981" />
        <SumItem label="Đúng giờ" value={present - late} color="#10b981" />
        <SumItem label="Trễ" value={late} color="#f59e0b" />
        <SumItem label="Vắng" value={absent} color="#ef4444" />
      </View>

      {/* Tabs */}
      <View style={s.tabBar}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.tab, tab === t.key && s.tabActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[s.tabTxt, tab === t.key && s.tabTxtActive]}>
              {t.label}
              {t.key === 'pending' && pendingCount > 0 ? ` (${pendingCount})` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={r => r.id}
        contentContainerStyle={s.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          loading
            ? <ActivityIndicator color={TEAL} style={{ marginTop: 40 }} />
            : <Text style={s.empty}>Không có dữ liệu</Text>
        }
        renderItem={({ item: r }) => (
          <View style={s.row}>
            <View style={s.rowLeft}>
              <Text style={s.rowDate}>{fmtWorkDate(r.work_date)}</Text>
              <View style={s.rowTimes}>
                <Text style={s.timeChip}>▶ {fmtTime(r.check_in)}</Text>
                <Text style={s.timeSep}>→</Text>
                <Text style={s.timeChip}>◼ {fmtTime(r.check_out)}</Text>
              </View>
              {r.note ? <Text style={s.rowNote} numberOfLines={1}>{r.note}</Text> : null}
            </View>
            <View style={s.rowRight}>
              <View style={[s.badge, { backgroundColor: (STATUS_COLOR[r.status] ?? '#9ca3af') + '20' }]}>
                <Text style={[s.badgeTxt, { color: STATUS_COLOR[r.status] ?? '#9ca3af' }]}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Text>
              </View>
              <Text style={s.typeIcon}>{TYPE_ICON[r.type] ?? '—'}</Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

function SumItem({ label, value, color }: { label: string; value: number; color: string }): JSX.Element {
  return (
    <View style={s.sumItem}>
      <Text style={[s.sumValue, { color }]}>{value}</Text>
      <Text style={s.sumLabel}>{label}</Text>
    </View>
  );
}

const TEAL = '#49B7C3';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f6f7f9' },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#fff',
    borderBottomWidth: 1, borderColor: '#f3f4f6',
  },
  navBtn: { padding: 8 },
  navArrow: { fontSize: 16, color: TEAL },
  monthLabel: { fontSize: 16, fontWeight: '700', color: '#111' },

  summaryBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    paddingVertical: 12, borderBottomWidth: 1, borderColor: '#f3f4f6',
  },
  sumItem: { flex: 1, alignItems: 'center' },
  sumValue: { fontSize: 20, fontWeight: '800' },
  sumLabel: { fontSize: 11, color: '#4b5563', marginTop: 2 },

  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderColor: '#e5e7eb',
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderColor: 'transparent' },
  tabActive: { borderColor: TEAL },
  tabTxt: { fontSize: 13, color: '#4b5563', fontWeight: '500' },
  tabTxtActive: { color: TEAL, fontWeight: '700' },

  list: { padding: 16, paddingBottom: 30 },
  empty: { textAlign: 'center', color: '#4b5563', marginTop: 40 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 3,
  },
  rowLeft: { flex: 1, marginRight: 10 },
  rowDate: { fontSize: 14, fontWeight: '700', color: '#111', marginBottom: 4 },
  rowTimes: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeChip: { fontSize: 13, color: '#111', fontVariant: ['tabular-nums'] },
  timeSep: { fontSize: 12, color: '#4b5563' },
  rowNote: { fontSize: 12, color: '#4b5563', marginTop: 4, fontStyle: 'italic' },
  rowRight: { alignItems: 'flex-end', gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeTxt: { fontSize: 12, fontWeight: '600' },
  typeIcon: { fontSize: 14 },
});
