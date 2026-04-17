import { toVietnamDate } from '../../src/common/utils/time-window';

/**
 * Tests for toVietnamDate() following TEST_CASES.md Module 13 (TZ-001 to TZ-005).
 * Vietnam is UTC+7, so midnight Vietnam = 17:00 UTC of the *previous* day.
 */
describe('toVietnamDate', () => {
  // TZ-001: 00:30 UTC on Apr 16 = 07:30 VN Apr 16 u2192 still Apr 16
  it('should_return_2026-04-16_when_timestamp_is_00:30_UTC_same_day', () => {
    expect(toVietnamDate('2026-04-16T00:30:00Z')).toBe('2026-04-16');
  });

  // TZ-002: 00:00 UTC on Apr 16 = 07:00 VN Apr 16 u2192 Apr 16
  it('should_return_2026-04-16_when_timestamp_is_00:00_UTC', () => {
    expect(toVietnamDate('2026-04-16T00:00:00Z')).toBe('2026-04-16');
  });

  // TZ-003: 23:59 UTC on Apr 15 = 06:59 VN Apr 16 u2192 Apr 16 (UTC+7 crosses midnight)
  it('should_return_2026-04-16_when_timestamp_is_23:59_UTC_prev_day', () => {
    expect(toVietnamDate('2026-04-15T23:59:00Z')).toBe('2026-04-16');
  });

  // TZ-004: 16:59 UTC on Apr 16 = 23:59 VN Apr 16 u2192 still Apr 16
  it('should_return_2026-04-16_when_timestamp_is_16:59_UTC', () => {
    expect(toVietnamDate('2026-04-16T16:59:00Z')).toBe('2026-04-16');
  });

  // TZ-005: 17:00 UTC on Apr 16 = 00:00 VN Apr 17 u2192 Apr 17 (VN day rolls over)
  it('should_return_2026-04-17_when_timestamp_is_17:00_UTC', () => {
    expect(toVietnamDate('2026-04-16T17:00:00Z')).toBe('2026-04-17');
  });
});
