// ────────────────────────────────────────────────────────────────
// Core Domain Entities
// ────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'hr' | 'branch_manager' | 'employee';

export interface User {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  role: UserRole;
  branch_id: string | null;
  branch_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  wifi_bssids: string[];
  telegram_chat_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type WeekDay = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = CN, 1 = T2, ..., 6 = T7

export interface Schedule {
  id: string;
  branch_id: string;
  branch_name: string;
  checkin_time: string;  // HH:mm
  checkout_time: string; // HH:mm
  window_minutes: number;
  active_days: WeekDay[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type AttendanceStatus = 'on_time' | 'late' | 'early_leave' | 'absent' | 'pending';
export type AttendanceType = 'auto' | 'manual';

export interface LocationSnapshot {
  latitude: number;
  longitude: number;
  gps_accuracy: number;
  wifi_bssid: string | null;
  wifi_ssid: string | null;
}

export interface DeviceSnapshot {
  device_id: string;
  device_model: string;
  os_version: string;
  app_version: string;
  is_vpn_active: boolean;
  is_mock_location: boolean;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  branch_id: string;
  branch_name: string;
  work_date: string;         // yyyy-MM-dd
  check_in: string | null;   // ISO datetime
  check_out: string | null;  // ISO datetime
  status: AttendanceStatus;
  type: AttendanceType;
  note: string | null;
  location_snapshot: LocationSnapshot | null;
  device_snapshot: DeviceSnapshot | null;
  created_at: string;
  updated_at: string;
}

export type FraudType =
  | 'DEVICE_MISMATCH'
  | 'VPN_DETECTED'
  | 'MOCK_LOCATION'
  | 'OUTSIDE_GEOFENCE'
  | 'WIFI_MISMATCH'
  | 'OUTSIDE_SCHEDULE'
  | 'RATE_LIMIT_EXCEEDED'
  | 'IP_BLACKLISTED'
  | 'GPS_INACCURATE';

export type FraudSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface FraudLog {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  branch_id: string;
  branch_name: string;
  type: FraudType;
  severity: FraudSeverity;
  description: string;
  device_snapshot: DeviceSnapshot;
  location_snapshot: LocationSnapshot;
  client_ip: string;
  is_resolved: boolean;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  branch_id: string | null;
  branch_name: string | null;
  registered_device_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SyncQueue {
  id: string;
  employee_id: string;
  payload: Record<string, unknown>;
  attempt_count: number;
  last_error: string | null;
  status: 'pending' | 'processing' | 'done' | 'failed';
  created_at: string;
  updated_at: string;
}

// ────────────────────────────────────────────────────────────────
// API Contracts
// ────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  employee: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    branch_id: string | null;
  };
}

export interface AttendanceFilters {
  date_from?: string;
  date_to?: string;
  branch_id?: string;
  status?: AttendanceStatus;
  search?: string;
  page?: number;
  per_page?: number;
  limit?: number;
}

export interface EmployeeFilters {
  branch_id?: string;
  role?: UserRole;
  search?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
  limit?: number;
}

export interface FraudFilters {
  severity?: FraudSeverity;
  type?: FraudType;
  date_from?: string;
  date_to?: string;
  is_resolved?: boolean;
  page?: number;
  per_page?: number;
  limit?: number;
}

export interface CreateBranchDto {
  code: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  wifi_bssids: string[];
  telegram_chat_id?: string;
  is_active: boolean;
}

export type UpdateBranchDto = Partial<CreateBranchDto>;

export interface CreateEmployeeDto {
  employee_code: string;
  full_name: string;
  email: string;
  phone?: string;
  role: UserRole;
  branch_id?: string;
  password: string;
}

export interface CreateScheduleDto {
  branch_id: string;
  checkin_time: string;
  checkout_time: string;
  window_minutes: number;
  active_days: WeekDay[];
  is_active: boolean;
}

export type UpdateScheduleDto = Partial<CreateScheduleDto>;

// ────────────────────────────────────────────────────────────────
// WebSocket Events
// ────────────────────────────────────────────────────────────────

export interface CheckinEvent {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  branch_id: string;
  branch_name: string;
  type: 'checkin' | 'checkout';
  status: AttendanceStatus;
  timestamp: string;
  location: LocationSnapshot;
}

export interface FraudEvent {
  id: string;
  employee_id: string;
  employee_code: string;
  full_name: string;
  branch_name: string;
  fraud_type: FraudType;
  severity: FraudSeverity;
  timestamp: string;
}

export interface StatsData {
  date: string;
  total_employees: number;
  total_checked_in: number;
  on_time: number;
  late: number;
  absent: number;
  check_in_rate: number; // percentage 0-100
}

export interface DailyTrendPoint {
  date: string;          // dd/MM
  on_time: number;
  late: number;
  absent: number;
  total: number;
}

export interface DashboardStats {
  today: StatsData;
  trend: DailyTrendPoint[];
}
