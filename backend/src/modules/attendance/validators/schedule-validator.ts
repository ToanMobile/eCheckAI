import {
  isWithinTimeWindow,
  getMinutesLate,
  getVietnamDayOfWeek,
} from '../../../common/utils/time-window';

export enum ScheduleCheckResult {
  ON_TIME = 'on_time',
  LATE = 'late',
  OUTSIDE_WINDOW = 'outside_window',
  WRONG_DAY = 'wrong_day',
}

export interface ScheduleValidationResult {
  result: ScheduleCheckResult;
  minutesLate: number;
  failure?: string;
}

/**
 * Validates that the timestamp falls within the schedule check-in window.
 * Uses Vietnam timezone (Asia/Ho_Chi_Minh).
 */
export function validateScheduleWindow(
  timestamp: string,
  checkinTime: string,
  windowMinutes: number,
  activeDays: number[],
  timezone: string = 'Asia/Ho_Chi_Minh',
): ScheduleValidationResult {
  // ISO day-of-week: getVietnamDayOfWeek returns 0=Sun..6=Sat
  // activeDays uses 1=Mon..7=Sun convention
  const jsDay = getVietnamDayOfWeek(timestamp);
  // Convert JS day (0=Sun) to ISO (1=Mon..7=Sun)
  const isoDay = jsDay === 0 ? 7 : jsDay;

  if (!activeDays.includes(isoDay)) {
    return {
      result: ScheduleCheckResult.WRONG_DAY,
      minutesLate: 0,
      failure: `WRONG_DAY: day ${isoDay} not in active_days`,
    };
  }

  const withinWindow = isWithinTimeWindow(
    timestamp,
    checkinTime,
    windowMinutes,
    timezone,
  );

  if (!withinWindow) {
    return {
      result: ScheduleCheckResult.OUTSIDE_WINDOW,
      minutesLate: 0,
      failure: 'OUTSIDE_SCHEDULE_WINDOW',
    };
  }

  const minutesLate = getMinutesLate(timestamp, checkinTime, timezone);

  return {
    result:
      minutesLate > 0
        ? ScheduleCheckResult.LATE
        : ScheduleCheckResult.ON_TIME,
    minutesLate,
  };
}
