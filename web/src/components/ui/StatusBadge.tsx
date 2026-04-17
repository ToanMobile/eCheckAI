import { CheckCircle2, Clock, XCircle, AlertCircle, MinusCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AttendanceStatus, FraudSeverity } from '@/types';

// ────────────────────────────────────────────────────────────────
// Attendance Status Badge
// ────────────────────────────────────────────────────────────────

interface StatusConfig {
  label: string;
  className: string;
  Icon: LucideIcon;
}

const statusConfig: Record<AttendanceStatus, StatusConfig> = {
  on_time: {
    label: 'Đúng giờ',
    className: 'bg-success-bg text-success-text',
    Icon: CheckCircle2,
  },
  late: {
    label: 'Muộn',
    className: 'bg-warning-bg text-warning-text',
    Icon: Clock,
  },
  early_leave: {
    label: 'Về sớm',
    className: 'bg-warning-bg text-warning-text',
    Icon: AlertCircle,
  },
  absent: {
    label: 'Vắng',
    className: 'bg-danger-bg text-danger-text',
    Icon: XCircle,
  },
  pending: {
    label: 'Chờ xác nhận',
    className: 'bg-neutral-100 text-neutral-600',
    Icon: MinusCircle,
  },
};

interface StatusBadgeProps {
  status: AttendanceStatus;
  className?: string;
  /** When true, renders a smaller pill without the icon */
  compact?: boolean;
}

export function StatusBadge({ status, className, compact = false }: StatusBadgeProps): JSX.Element {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className,
      )}
      aria-label={config.label}
    >
      {!compact && <config.Icon className="w-3 h-3 shrink-0" aria-hidden="true" />}
      {config.label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// Fraud Severity Badge
// ────────────────────────────────────────────────────────────────

interface SeverityConfig {
  label: string;
  className: string;
}

const severityConfig: Record<FraudSeverity, SeverityConfig> = {
  critical: {
    label: 'Nghưỡm trọng',
    className: 'bg-danger-bg text-danger-text border border-danger-base/20',
  },
  high: {
    label: 'Cao',
    className: 'bg-orange-100 text-orange-800 border border-orange-200',
  },
  medium: {
    label: 'Trung bình',
    className: 'bg-warning-bg text-warning-text border border-warning-base/20',
  },
  low: {
    label: 'Thấp',
    className: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
  },
};

interface SeverityBadgeProps {
  severity: FraudSeverity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps): JSX.Element {
  const config = severityConfig[severity];

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wide',
        config.className,
        className,
      )}
      aria-label={config.label}
    >
      {config.label}
    </span>
  );
}

// ────────────────────────────────────────────────────────────────
// Generic colored badge (for role labels, etc.)
// ────────────────────────────────────────────────────────────────

interface RoleBadgeProps {
  role: string;
  className?: string;
}

const roleConfig: Record<string, { label: string; className: string }> = {
  super_admin: { label: 'Super Admin', className: 'bg-primary-100 text-primary-800' },
  hr: { label: 'HR', className: 'bg-info-bg text-info-text' },
  branch_manager: { label: 'Quản lý CN', className: 'bg-purple-100 text-purple-800' },
  employee: { label: 'Nhân viên', className: 'bg-neutral-100 text-neutral-700' },
};

export function RoleBadge({ role, className }: RoleBadgeProps): JSX.Element {
  const config = roleConfig[role] ?? { label: role, className: 'bg-neutral-100 text-neutral-700' };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
        config.className,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
