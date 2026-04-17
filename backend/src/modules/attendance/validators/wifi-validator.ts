export interface WifiValidationResult {
  passed: boolean;
  failure?: string;
}

/**
 * Validates that the provided BSSID exists in the branch's allowed BSSID list.
 * BSSID comparison is case-insensitive.
 */
export function validateWifiBssid(
  bssid: string,
  allowedBssids: string[],
): WifiValidationResult {
  if (!bssid || allowedBssids.length === 0) {
    return { passed: false, failure: 'WIFI_BSSID_NOT_CONFIGURED' };
  }

  const normalizedBssid = bssid.toUpperCase();
  const isAllowed = allowedBssids.some(
    (allowed) => allowed.toUpperCase() === normalizedBssid,
  );

  if (!isAllowed) {
    return { passed: false, failure: 'WIFI_MISMATCH' };
  }

  return { passed: true };
}
