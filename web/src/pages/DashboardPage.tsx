import { useQuery } from '@tanstack/react-query';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  Activity,
} from 'lucide-react';
import { api } from '@/lib/api';
import { StatsCard } from '@/components/ui/StatsCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAttendanceStore } from '@/store/attendance.store';
import { formatTime } from '@/lib/utils';
import type { DashboardStats } from '@/types';

// ────────────────────────────────────────────────────────────────
// Data fetching
// ────────────────────────────────────────────────────────────────

async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await api.get<{ data: DashboardStats }>(
    '/attendance/stats',
  );
  return data.data;
}

// ────────────────────────────────────────────────────────────────
// Chart tooltip
// ────────────────────────────────────────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}): JSX.Element | null {
  if (!active || !payload?.length) return null;

  return (
    <div className="card p-3 text-sm">
      <p className="font-semibold text-neutral-700 mb-2">{label}</p>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-neutral-600">{entry.name}:</span>
          <span className="font-medium text-neutral-950">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Live feed
// ────────────────────────────────────────────────────────────────

function LiveFeed(): JSX.Element {
  const recentCheckins = useAttendanceStore((s) => s.recentCheckins);

  return (
    <div className="card">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
        <h3 className="text-base font-semibold text-neutral-950">
          Lượt chấm công mới nhất
        </h3>
        <span className="flex items-center gap-1.5 text-xs text-success-text">
          <span className="w-2 h-2 rounded-full bg-success-base animate-pulse" />
          Trực tiếp
        </span>
      </div>

      <div className="divide-y divide-neutral-100">
        {recentCheckins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Activity
              className="w-10 h-10 text-neutral-300 mb-3"
              aria-hidden="true"
            />
            <p className="text-sm text-neutral-500">
              Chưa có lượt chấm công hôm nay
            </p>
          </div>
        ) : (
          recentCheckins.slice(0, 10).map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between px-5 py-3 hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-primary-700">
                    {event.full_name
                      .split(' ')
                      .slice(-2)
                      .map((w) => w[0])
                      .join('')
                      .toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-neutral-950 truncate">
                    {event.full_name}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">
                    {event.branch_name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-4">
                <StatusBadge status={event.status} compact />
                <span className="font-mono text-xs text-neutral-600">
                  {formatTime(event.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Dashboard page
// ────────────────────────────────────────────────────────────────

export function DashboardPage(): JSX.Element {
  const liveStats = useAttendanceStore((s) => s.liveStats);

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: fetchDashboardStats,
    refetchInterval: 60_000, // refresh every minute
    staleTime: 30_000,
  });

  const stats = liveStats
    ? {
        total: liveStats.total_employees,
        onTime: liveStats.on_time,
        late: liveStats.late,
        absent: liveStats.absent,
        checkInRate: liveStats.check_in_rate,
      }
    : data
    ? {
        total: data.today.total_employees,
        onTime: data.today.on_time,
        late: data.today.late,
        absent: data.today.absent,
        checkInRate: data.today.check_in_rate,
      }
    : null;

  const today = new Date().toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="text-h1">Dashboard</h1>
          <p className="text-body-sm mt-1 capitalize">{today}</p>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard
          label="Tổng nhân viên"
          value={stats?.total ?? 0}
          icon={Users}
          loading={isLoading && !stats}
          iconClassName="bg-info-bg text-info-base"
        />
        <StatsCard
          label="Đúng giờ"
          value={stats?.onTime ?? 0}
          icon={CheckCircle2}
          loading={isLoading && !stats}
          iconClassName="bg-success-bg text-success-base"
        />
        <StatsCard
          label="Đi muộn"
          value={stats?.late ?? 0}
          icon={Clock}
          loading={isLoading && !stats}
          iconClassName="bg-warning-bg text-warning-base"
        />
        <StatsCard
          label="Vắng mặt"
          value={stats?.absent ?? 0}
          icon={XCircle}
          loading={isLoading && !stats}
          iconClassName="bg-danger-bg text-danger-base"
        />
      </div>

      {/* Chart + Live Feed */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-4">
        {/* Area chart: 7-day attendance trend */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-semibold text-neutral-950">
              Xu xướng chấm công 7 ngày
            </h3>
            {isLoading && !data && (
              <span className="text-xs text-neutral-400">Đang tải...</span>
            )}
          </div>

          {isLoading && !data ? (
            <div className="h-56 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={224}>
              <AreaChart
                data={data?.trend ?? []}
                margin={{ top: 4, right: 4, bottom: 0, left: -16 }}
              >
                <defs>
                  <linearGradient id="colorOnTime" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#11A22F" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#11A22F" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorLate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF9900" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#EF9900" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAbsent" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#E7000B" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#E7000B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E5" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12, fill: '#737373' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: '#737373' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '12px', paddingTop: '16px' }}
                />
                <Area
                  type="monotone"
                  dataKey="on_time"
                  name="Đúng giờ"
                  stroke="#11A22F"
                  strokeWidth={2}
                  fill="url(#colorOnTime)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="late"
                  name="Muộn"
                  stroke="#EF9900"
                  strokeWidth={2}
                  fill="url(#colorLate)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="absent"
                  name="Vắng"
                  stroke="#E7000B"
                  strokeWidth={2}
                  fill="url(#colorAbsent)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Live feed */}
        <LiveFeed />
      </div>

      {/* Check-in rate */}
      {stats && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-neutral-700">
              Tỷ lệ chấm công hôm nay
            </p>
            <p className="text-sm font-semibold text-neutral-950">
              {stats.checkInRate.toFixed(1)}%
            </p>
          </div>
          <div
            className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={stats.checkInRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Tỷ lệ chấm công: ${stats.checkInRate.toFixed(1)}%`}
          >
            <div
              className="h-full bg-primary-500 rounded-full transition-all duration-slow"
              style={{ width: `${Math.min(stats.checkInRate, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-xs text-neutral-400">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
      )}
    </div>
  );
}
