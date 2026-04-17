import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, RefreshControl, SafeAreaView,
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { fetchMonthlyStats, MonthlyStats } from '../api/attendanceApi';

function fmtTime(iso: string): string {
  return iso ? iso.slice(11, 16) : '--:--';
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  const dow = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const day = dow[new Date(iso).getDay()] ?? '';
  return `${day} ${d}/${m}/${y}`;
}

const DAYS_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function ReportScreen(): JSX.Element {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [stats, setStats] = useState<MonthlyStats | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchMonthlyStats(year, month);
      setStats(data);
    } catch {
      setStats(null);
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

  const attendanceRate = stats && stats.total_working_days > 0
    ? Math.round((stats.present_days / stats.total_working_days) * 100)
    : 0;

  const onTimeRate = stats && stats.present_days > 0
    ? Math.round((stats.on_time_days / stats.present_days) * 100)
    : 0;

  return (
    <SafeAreaView style={s.root}>
      {/* Month nav */}
      <View style={s.monthNav}>
        <TouchableOpacity onPress={() => navigate(-1)} style={s.navBtn}>
          <Text style={s.navArrow}>◀</Text>
        </TouchableOpacity>
        <Text style={s.monthLabel}>Báo cáo {String(month).padStart(2, '0')}/{year}</Text>
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

      {loading
        ? <ActivityIndicator color={TEAL} style={{ marginTop: 60 }} />
        : (
          <ScrollView
            contentContainerStyle={s.body}
            refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
          >
            {/* Stat cards */}
            <View style={s.cardGrid}>
              <StatCard icon="📅" label="Ngày làm việc" value={stats?.total_working_days ?? 0} color="#6366f1" />
              <StatCard icon="✅" label="Có mặt" value={stats?.present_days ?? 0} color="#10b981" />
              <StatCard icon="⏰" label="Đúng giờ" value={stats?.on_time_days ?? 0} color="#10b981" />
              <StatCard icon="🟡" label="Trễ" value={stats?.late_days ?? 0} color="#f59e0b" />
              <StatCard icon="❌" label="Vắng" value={stats?.absent_days ?? 0} color="#ef4444" />
              <StatCard icon="📝" label="Chấm bù" value={stats?.manual_days ?? 0} color="#8b5cf6" />
            </View>

            {/* Rate bars */}
            <View style={s.card}>
              <Text style={s.cardTitle}>TỈ LỆ</Text>
              <RateBar label="Chuyên cần" pct={attendanceRate} color="#10b981" />
              <RateBar label="Đúng giờ" pct={onTimeRate} color={onTimeRate >= 90 ? '#10b981' : onTimeRate >= 70 ? '#f59e0b' : '#ef4444'} />
            </View>

            {/* Week bar chart */}
            <View style={s.card}>
              <Text style={s.cardTitle}>PHÂN BỐ THEO NGÀY TUẦN (cả tháng)</Text>
              <WeekDistChart stats={stats} year={year} month={month} />
            </View>

            {/* Late details */}
            {(stats?.late_details?.length ?? 0) > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>CHI TIẾT CÁC LẦN TRỄ</Text>
                {stats!.late_details.map((d, i) => (
                  <View key={i} style={s.lateRow}>
                    <View>
                      <Text style={s.lateDate}>{fmtDate(d.work_date)}</Text>
                      <Text style={s.lateTime}>Check-in lúc {fmtTime(d.check_in)}</Text>
                    </View>
                    <View style={s.lateBadge}>
                      <Text style={s.lateBadgeTxt}>
                        {d.late_minutes > 0 ? `Trễ ${d.late_minutes % 60}p` : 'Trễ'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {!stats && !loading && (
              <Text style={s.empty}>Không có dữ liệu tháng này</Text>
            )}
          </ScrollView>
        )}
    </SafeAreaView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ icon, label, value, color }: {
  icon: string; label: string; value: number; color: string;
}): JSX.Element {
  return (
    <View style={[s.statCard, { borderTopColor: color }]}>
      <Text style={s.statIcon}>{icon}</Text>
      <Text style={[s.statValue, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function RateBar({ label, pct, color }: { label: string; pct: number; color: string }): JSX.Element {
  return (
    <View style={s.rateRow}>
      <Text style={s.rateLabel}>{label}</Text>
      <View style={s.rateTrack}>
        <View style={[s.rateFill, { width: `${pct}%` as `${number}%`, backgroundColor: color }]} />
      </View>
      <Text style={[s.ratePct, { color }]}>{pct}%</Text>
    </View>
  );
}

function WeekDistChart({ stats, year, month }: {
  stats: MonthlyStats | null; year: number; month: number;
}): JSX.Element {
  // Count on_time/late/absent per weekday (Mon=0 … Sun=6)
  const counts = Array.from({ length: 7 }, () => ({ present: 0, late: 0, absent: 0, total: 0 }));

  if (stats) {
    // We don't have per-day detail here; show placeholder bars from stats totals
    // Just render a simple per-weekday distribution using the total working days in month
    const lastDay = new Date(year, month, 0).getDate();
    for (let d = 1; d <= lastDay; d++) {
      const dow = new Date(year, month - 1, d).getDay(); // 0=Sun
      const idx = dow === 0 ? 6 : dow - 1; // Mon=0…Sun=6
      if (counts[idx]) counts[idx].total++;
    }
  }

  const maxTotal = Math.max(...counts.map(c => c.total), 1);

  return (
    <View style={s.weekChart}>
      {DAYS_SHORT.map((day, i) => {
        const c = counts[i] ?? { total: 0 };
        const barH = Math.round((c.total / maxTotal) * 48);
        return (
          <View key={day} style={s.weekCol}>
            <Text style={s.weekCount}>{c.total}</Text>
            <View style={s.weekBarTrack}>
              <View style={[s.weekBar, { height: barH, backgroundColor: i < 5 ? TEAL : '#e5e7eb' }]} />
            </View>
            <Text style={[s.weekDay, i >= 5 && { color: '#ef4444' }]}>{day}</Text>
          </View>
        );
      })}
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

  body: { padding: 16, paddingBottom: 40 },

  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statCard: {
    width: '31%', backgroundColor: '#fff', borderRadius: 12, padding: 14,
    alignItems: 'center', borderTopWidth: 3,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  statIcon: { fontSize: 22, marginBottom: 4 },
  statValue: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, color: '#4b5563', marginTop: 2, textAlign: 'center' },

  card: {
    backgroundColor: '#fff', borderRadius: 14, padding: 18, marginBottom: 12,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 3,
  },
  cardTitle: { fontSize: 11, fontWeight: '700', color: '#4b5563', letterSpacing: 0.8, marginBottom: 14 },

  rateRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  rateLabel: { fontSize: 13, color: '#111', width: 80 },
  rateTrack: { flex: 1, height: 8, backgroundColor: '#f3f4f6', borderRadius: 4, overflow: 'hidden' },
  rateFill: { height: 8, borderRadius: 4 },
  ratePct: { fontSize: 13, fontWeight: '700', width: 42, textAlign: 'right' },

  weekChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  weekCol: { flex: 1, alignItems: 'center', gap: 4 },
  weekCount: { fontSize: 10, color: '#4b5563' },
  weekBarTrack: { height: 52, justifyContent: 'flex-end' },
  weekBar: { width: 22, borderRadius: 4, minHeight: 4 },
  weekDay: { fontSize: 11, color: '#374151', fontWeight: '600' },

  lateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f3f4f6',
  },
  lateDate: { fontSize: 14, fontWeight: '600', color: '#111' },
  lateTime: { fontSize: 12, color: '#374151', marginTop: 2 },
  lateBadge: { backgroundColor: '#fef3c7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  lateBadgeTxt: { color: '#d97706', fontSize: 12, fontWeight: '700' },

  empty: { textAlign: 'center', color: '#4b5563', marginTop: 60, fontSize: 14 },
});
