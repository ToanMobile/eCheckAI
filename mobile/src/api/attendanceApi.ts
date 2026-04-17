import axios, { AxiosInstance } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// adb reverse tcp:3000 tcp:3000  →  physical device reaches host via localhost
export const API_BASE = 'http://localhost:3000/api/v1';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  employee: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    branch_id: string | null;
  };
}

export interface BranchDetail {
  id: string;
  name: string;
  address: string;
  // API returns snake_case field names
  latitude: number;
  longitude: number;
  radius_meters: number;
  wifi_bssids: string[];
  wifi_ssids: string[];
  timezone: string;
  is_active: boolean;
}

export interface ScheduleDetail {
  // API returns snake_case field names
  checkin_time: string;   // HH:mm:ss
  checkout_time: string;  // HH:mm:ss
  window_minutes: number;
  active_days: number[];  // 1=Mon … 7=Sun
  // camelCase aliases for backward compat with cached values
  checkinTime?: string;
  checkoutTime?: string;
  windowMinutes?: number;
  activeDays?: number[];
}

export interface AutoCheckinPayload {
  employee_id: string;
  wifi_bssid: string | null;
  wifi_ssid: string | null;
  latitude: number;
  longitude: number;
  gps_accuracy: number;
  device_id: string;
  device_model: string;
  os_version: string;
  app_version: string;
  timestamp: string;
  is_vpn_active: boolean;
  is_mock_location: boolean;
}

export type AttendanceStatus = 'on_time' | 'late' | 'absent' | 'early_leave' | 'pending';

export interface AttendanceRecord {
  id: string;
  work_date: string;       // yyyy-MM-dd
  check_in: string | null; // ISO
  check_out: string | null;
  status: AttendanceStatus;
  type: 'auto_checkin' | 'auto_checkout' | 'manual';
  note: string | null;
  branch_name: string;
  full_name: string;
}

export interface MonthlyStats {
  total_working_days: number;
  present_days: number;
  on_time_days: number;
  late_days: number;
  absent_days: number;
  manual_days: number;
  late_details: Array<{
    work_date: string;
    check_in: string;
    late_minutes: number;
  }>;
}

// ─── Axios client ─────────────────────────────────────────────────────────────

let _client: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (_client) return _client;
  _client = axios.create({ baseURL: API_BASE, timeout: 12000 });
  _client.interceptors.request.use(async (config) => {
    const token = await AsyncStorage.getItem('sa:access_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  return _client;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await axios.post<{ success: boolean; data: LoginResponse }>(
    `${API_BASE}/auth/login`,
    { email, password },
    { timeout: 12000 },
  );
  if (!data.success) throw new Error('Login failed');
  return data.data;
}

// ─── Branch / Schedule ────────────────────────────────────────────────────────

export async function fetchBranch(branchId: string): Promise<BranchDetail> {
  const { data } = await getClient().get<{ success: boolean; data: BranchDetail }>(
    `/branches/${branchId}`,
  );
  return data.data;
}

export async function fetchMySchedule(): Promise<ScheduleDetail> {
  const { data } = await getClient().get<{ success: boolean; data: ScheduleDetail | ScheduleDetail[] }>(
    '/schedules/my',
  );
  const raw = Array.isArray(data.data) ? data.data[0] : data.data;
  return normalizeSchedule(raw);
}

/** Normalizes a ScheduleDetail to always have both snake_case and camelCase keys. */
export function normalizeSchedule(s: ScheduleDetail): ScheduleDetail {
  const checkinTime = s.checkin_time ?? s.checkinTime ?? '';
  const checkoutTime = s.checkout_time ?? s.checkoutTime ?? '';
  const windowMinutes = s.window_minutes ?? s.windowMinutes ?? 15;
  const activeDays = s.active_days ?? s.activeDays ?? [1, 2, 3, 4, 5];
  return {
    ...s,
    checkin_time: checkinTime,
    checkout_time: checkoutTime,
    window_minutes: windowMinutes,
    active_days: activeDays,
    // camelCase aliases for any code still using them
    checkinTime,
    checkoutTime,
    windowMinutes,
    activeDays,
  };
}

// ─── Auto check-in / check-out ────────────────────────────────────────────────

export async function postAutoCheckin(
  payload: AutoCheckinPayload,
  idempotencyKey: string,
): Promise<{ status: string; checkInTime: string; branchName: string }> {
  const { data } = await getClient().post('/attendance/auto-checkin', payload, {
    headers: { 'x-idempotency-key': idempotencyKey },
  });
  return data.data as { status: string; checkInTime: string; branchName: string };
}

export async function postAutoCheckout(
  payload: AutoCheckinPayload,
  idempotencyKey: string,
): Promise<{ checkOutTime: string; branchName: string }> {
  const { data } = await getClient().post('/attendance/auto-checkout', payload, {
    headers: { 'x-idempotency-key': idempotencyKey },
  });
  return data.data as { checkOutTime: string; branchName: string };
}

// ─── Manual (makeup) ─────────────────────────────────────────────────────────

export interface ManualCheckinPayload {
  work_date: string;        // yyyy-MM-dd
  check_in: string | null;  // ISO datetime or null
  check_out: string | null;
  note: string;
}

export async function postManualCheckin(
  payload: ManualCheckinPayload,
): Promise<AttendanceRecord> {
  const { data } = await getClient().post<{ success: boolean; data: AttendanceRecord }>(
    '/attendance/self-manual',
    payload,
  );
  return data.data;
}

// ─── Attendance list ──────────────────────────────────────────────────────────

export async function fetchMyAttendance(params: {
  page?: number;
  limit?: number;
  date_from?: string;
  date_to?: string;
  status?: string;
}): Promise<{ items: AttendanceRecord[]; total: number; totalPages: number }> {
  const { data } = await getClient().get<{
    success: boolean;
    data: { items: AttendanceRecord[]; total: number; totalPages: number };
  }>('/attendance/my', { params: { limit: 50, ...params } });
  return data.data;
}

export async function fetchTodayAttendance(): Promise<AttendanceRecord | null> {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh' });
  try {
    const res = await fetchMyAttendance({ date_from: today, date_to: today, limit: 1 } as Parameters<typeof fetchMyAttendance>[0]);
    return res.items[0] ?? null;
  } catch {
    return null;
  }
}

// ─── Monthly stats ────────────────────────────────────────────────────────────

export async function fetchMonthlyStats(year: number, month: number): Promise<MonthlyStats> {
  const pad = (n: number) => String(n).padStart(2, '0');
  const date_from = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const date_to = `${year}-${pad(month)}-${pad(lastDay)}`;

  const res = await fetchMyAttendance({ date_from, date_to, limit: 100 } as Parameters<typeof fetchMyAttendance>[0]);
  const items = res.items;

  const present = items.filter(r => r.check_in !== null);
  const late = items.filter(r => r.status === 'late');
  const absent = items.filter(r => r.status === 'absent');
  const manual = items.filter(r => r.type === 'manual');

  // Count working days in month (Mon–Sat, excluding Sun=0)
  let workingDays = 0;
  for (let d = 1; d <= lastDay; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0) workingDays++;
  }

  const late_details = late.map(r => {
    const ci = r.check_in ?? '';
    const [hh, mm] = ci.slice(11, 16).split(':').map(Number);
    // we don't have schedule here, approximate 0 as base
    return {
      work_date: r.work_date,
      check_in: ci,
      late_minutes: (hh ?? 0) * 60 + (mm ?? 0),
    };
  });

  return {
    total_working_days: workingDays,
    present_days: present.length,
    on_time_days: items.filter(r => r.status === 'on_time').length,
    late_days: late.length,
    absent_days: absent.length,
    manual_days: manual.length,
    late_details,
  };
}

// ─── Sync ─────────────────────────────────────────────────────────────────────

export async function postBatchSync(
  employeeId: string,
  items: Array<{
    event_type: string;
    payload: AutoCheckinPayload;
    client_timestamp: string;
    idempotency_key: string;
  }>,
): Promise<{ processed: number; failed: number }> {
  const { data } = await getClient().post('/sync/batch', { employee_id: employeeId, items });
  return data.data as { processed: number; failed: number };
}
