import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, isValid } from 'date-fns';
import { vi } from 'date-fns/locale';

/**
 * Merge Tailwind CSS class names with conflict resolution.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Format an ISO datetime string to Vietnamese time (HH:mm)
 */
export function formatTime(iso: string): string {
  if (!iso) return '--:--';
  try {
    const date = parseISO(iso);
    if (!isValid(date)) return '--:--';
    return format(date, 'HH:mm');
  } catch {
    return '--:--';
  }
}

/**
 * Format an ISO datetime string to Vietnamese date (dd/MM/yyyy)
 */
export function formatDate(iso: string): string {
  if (!iso) return '--/--/----';
  try {
    const date = parseISO(iso);
    if (!isValid(date)) return '--/--/----';
    return format(date, 'dd/MM/yyyy', { locale: vi });
  } catch {
    return '--/--/----';
  }
}

/**
 * Format an ISO datetime string to full Vietnamese datetime (dd/MM/yyyy HH:mm)
 */
export function formatDatetime(iso: string): string {
  if (!iso) return '--/--/---- --:--';
  try {
    const date = parseISO(iso);
    if (!isValid(date)) return '--/--/---- --:--';
    return format(date, 'dd/MM/yyyy HH:mm', { locale: vi });
  } catch {
    return '--/--/---- --:--';
  }
}

/**
 * Format an ISO datetime to relative label (Today, Yesterday, or dd/MM/yyyy)
 */
export function formatRelativeDate(iso: string): string {
  if (!iso) return '';
  try {
    const date = parseISO(iso);
    if (!isValid(date)) return '';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) {
      return 'Hôm nay';
    }
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) {
      return 'Hôm qua';
    }
    return formatDate(iso);
  } catch {
    return '';
  }
}

/**
 * Format number with thousands separator
 */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('vi-VN').format(n);
}

/**
 * Format percentage delta with sign
 */
export function formatDelta(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(1)}%`;
}

/**
 * Truncate a string to a max length with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}

/**
 * Extract initials from a full name (max 2 chars)
 */
export function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Map role key to Vietnamese display label
 */
export function getRoleLabel(role: string): string {
  const map: Record<string, string> = {
    super_admin: 'Super Admin',
    hr: 'HR',
    branch_manager: 'Quản lý chi nhánh',
    employee: 'Nhân viên',
  };
  return map[role] ?? role;
}

/**
 * Check if a value is a non-empty string
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Build query string from a params object (excludes undefined/null)
 */
export function buildQueryString(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}
