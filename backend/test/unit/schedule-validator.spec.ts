import {
  validateScheduleWindow,
  ScheduleCheckResult,
} from '../../src/modules/attendance/validators/schedule-validator';

describe('validateScheduleWindow', () => {
  // Monday 2025-01-13 08:00 Vietnam time = 2025-01-13T01:00:00.000Z
  // Vietnam is UTC+7
  const mondayOnTime = '2025-01-13T01:00:00.000Z'; // exactly 08:00 VN
  const mondayLate5min = '2025-01-13T01:05:00.000Z'; // 08:05 VN
  const mondayLate20min = '2025-01-13T01:20:00.000Z'; // 08:20 VN — outside 15min window
  const mondayEarly5min = '2025-01-13T00:55:00.000Z'; // 07:55 VN
  const sundayOnTime = '2025-01-12T01:00:00.000Z'; // Sunday, not in Mon-Fri

  const checkinTime = '08:00';
  const windowMinutes = 15;
  const activeDays = [1, 2, 3, 4, 5]; // Mon-Fri (ISO)

  it('should_return_on_time_when_exact_schedule_time', () => {
    const result = validateScheduleWindow(
      mondayOnTime,
      checkinTime,
      windowMinutes,
      activeDays,
    );
    expect(result.result).toBe(ScheduleCheckResult.ON_TIME);
    expect(result.minutesLate).toBe(0);
  });

  it('should_return_on_time_when_5_minutes_early', () => {
    const result = validateScheduleWindow(
      mondayEarly5min,
      checkinTime,
      windowMinutes,
      activeDays,
    );
    expect(result.result).toBe(ScheduleCheckResult.ON_TIME);
    expect(result.minutesLate).toBe(0);
  });

  it('should_return_late_when_5_minutes_past_schedule', () => {
    const result = validateScheduleWindow(
      mondayLate5min,
      checkinTime,
      windowMinutes,
      activeDays,
    );
    expect(result.result).toBe(ScheduleCheckResult.LATE);
    expect(result.minutesLate).toBe(5);
  });

  it('should_return_outside_window_when_beyond_window', () => {
    const result = validateScheduleWindow(
      mondayLate20min,
      checkinTime,
      windowMinutes,
      activeDays,
    );
    expect(result.result).toBe(ScheduleCheckResult.OUTSIDE_WINDOW);
  });

  it('should_return_wrong_day_on_sunday_for_weekday_schedule', () => {
    const result = validateScheduleWindow(
      sundayOnTime,
      checkinTime,
      windowMinutes,
      activeDays,
    );
    expect(result.result).toBe(ScheduleCheckResult.WRONG_DAY);
  });

  it('should_accept_sunday_if_in_active_days', () => {
    const allDays = [1, 2, 3, 4, 5, 6, 7];
    const result = validateScheduleWindow(
      sundayOnTime,
      checkinTime,
      windowMinutes,
      allDays,
    );
    expect(result.result).not.toBe(ScheduleCheckResult.WRONG_DAY);
  });
});
