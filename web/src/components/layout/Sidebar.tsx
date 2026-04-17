import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Clock,
  Users,
  CalendarCheck,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WsStatus } from '@/hooks/useAttendanceWebSocket';

const NAV_ITEMS = [
  {
    to: '/',
    label: 'Dashboard',
    Icon: LayoutDashboard,
    end: true,
  },
  {
    to: '/branches',
    label: 'Chi nhánh',
    Icon: Building2,
    end: false,
  },
  {
    to: '/schedules',
    label: 'Lịch ca',
    Icon: Clock,
    end: false,
  },
  {
    to: '/employees',
    label: 'Nhân viên',
    Icon: Users,
    end: false,
  },
  {
    to: '/attendance',
    label: 'Chấm công',
    Icon: CalendarCheck,
    end: false,
  },
  {
    to: '/fraud',
    label: 'Phát hiện gian lận',
    Icon: ShieldAlert,
    end: false,
  },
] as const;

const WS_STATUS_COLOR: Record<string, string> = {
  connected: 'bg-success-base',
  connecting: 'bg-warning-base animate-pulse',
  disconnected: 'bg-neutral-400',
  error: 'bg-danger-base',
};

const WS_STATUS_LABEL: Record<string, string> = {
  connected: 'Kết nối trực tiếp',
  connecting: 'Đang kết nối...',
  disconnected: 'Ngắt kết nối',
  error: 'Lỗi kết nối',
};

interface SidebarProps {
  className?: string;
  wsStatus?: WsStatus;
}

export function Sidebar({ className, wsStatus = 'disconnected' }: SidebarProps): JSX.Element {
  const status = wsStatus;
  const location = useLocation();

  return (
    <aside
      className={cn(
        'flex flex-col w-[240px] shrink-0 h-screen sticky top-0',
        'bg-neutral-50 border-r border-neutral-200',
        className,
      )}
      aria-label="Navigation chính"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 border-b border-neutral-200 shrink-0">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-500"
          aria-hidden="true"
        >
          <Activity className="w-4.5 h-4.5 text-white" />
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-950 leading-tight">
            Smart Attendance
          </p>
          <p className="text-[10px] text-neutral-400 leading-tight">Giải Pháp Số</p>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto py-3 px-3" aria-label="Menu">
        <ul className="space-y-0.5" role="list">
          {NAV_ITEMS.map(({ to, label, Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-fast',
                    isActive
                      ? [
                          'bg-primary-50 text-primary-700',
                          'border-l-[3px] border-primary-500',
                          'pl-[calc(0.75rem-1px)] rounded-l-none',
                        ]
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
                  )
                }
                aria-current={location.pathname === to ? 'page' : undefined}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* WebSocket status indicator */}
      <div className="px-4 py-3 border-t border-neutral-200 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-2 h-2 rounded-full shrink-0',
              WS_STATUS_COLOR[status] ?? 'bg-neutral-400',
            )}
            aria-hidden="true"
          />
          <span className="text-xs text-neutral-500">
            {WS_STATUS_LABEL[status] ?? 'Không xác định'}
          </span>
        </div>
      </div>
    </aside>
  );
}
