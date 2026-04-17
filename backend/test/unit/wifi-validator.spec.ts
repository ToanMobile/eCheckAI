import { validateWifiBssid } from '../../src/modules/attendance/validators/wifi-validator';

describe('validateWifiBssid', () => {
  const allowedBssids = [
    'AA:BB:CC:DD:EE:FF',
    '11:22:33:44:55:66',
  ];

  it('should_pass_when_bssid_matches_exactly', () => {
    const result = validateWifiBssid('AA:BB:CC:DD:EE:FF', allowedBssids);
    expect(result.passed).toBe(true);
  });

  it('should_pass_when_bssid_matches_case_insensitively', () => {
    const result = validateWifiBssid('aa:bb:cc:dd:ee:ff', allowedBssids);
    expect(result.passed).toBe(true);
  });

  it('should_fail_when_bssid_not_in_allowed_list', () => {
    const result = validateWifiBssid('99:88:77:66:55:44', allowedBssids);
    expect(result.passed).toBe(false);
    expect(result.failure).toBe('WIFI_MISMATCH');
  });

  it('should_fail_when_allowed_list_is_empty', () => {
    const result = validateWifiBssid('AA:BB:CC:DD:EE:FF', []);
    expect(result.passed).toBe(false);
    expect(result.failure).toBe('WIFI_BSSID_NOT_CONFIGURED');
  });

  it('should_fail_when_bssid_is_empty_string', () => {
    const result = validateWifiBssid('', allowedBssids);
    expect(result.passed).toBe(false);
  });
});
