import Geolocation from 'react-native-geolocation-service';
import WifiManager from 'react-native-wifi-reborn';
import { Platform, PermissionsAndroid } from 'react-native';
import { haversineDistance } from '../utils/haversine';
import { getDeviceSnapshot, getLastUnlockElapsedMinutes } from '../utils/deviceInfo';
import { isVpnActive, isMockLocationActive } from '../utils/vpnDetector';

export interface CheckResult {
  passed: boolean;
  failures: string[];
  snapshot: {
    wifi_bssid: string | null;
    wifi_ssid: string | null;
    latitude: number;
    longitude: number;
    gps_accuracy: number;
    is_vpn_active: boolean;
    is_mock_location: boolean;
    device_id: string;
    device_model: string;
    os_version: string;
    app_version: string;
    timestamp: string;
    last_unlock_elapsed_minutes: number;
  };
}

export interface BranchConfig {
  lat: number;
  lng: number;
  radius: number;
  wifi_bssids: string[];
}

const GPS_ACCURACY_THRESHOLD_M = 50;
const LAST_UNLOCK_THRESHOLD_MIN = 90;
const WIFI_RETRY = 3;
const WIFI_RETRY_DELAY_MS = 5000;

async function requestLocationPermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return granted === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

async function getGpsPosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
  isMock: boolean;
}> {
  return new Promise((resolve, reject) => {
    Geolocation.getCurrentPosition(
      (pos) => {
        const mockedField = (pos as { mocked?: boolean }).mocked;
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          isMock: mockedField === true,
        });
      },
      (err) => reject(new Error(`GPS_ERROR: ${err.message}`)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

async function scanWifiWithRetry(): Promise<{ bssid: string | null; ssid: string | null }> {
  for (let attempt = 0; attempt < WIFI_RETRY; attempt++) {
    try {
      const bssid = await WifiManager.getBSSID();
      const ssid = await WifiManager.getCurrentWifiSSID();
      if (bssid) return { bssid, ssid };
    } catch {
      // ignore, retry
    }
    if (attempt < WIFI_RETRY - 1) {
      await new Promise<void>((r) => setTimeout(() => r(), WIFI_RETRY_DELAY_MS));
    }
  }
  return { bssid: null, ssid: null };
}

export async function runConditionChecks(
  branch: BranchConfig,
): Promise<CheckResult> {
  const failures: string[] = [];
  const now = new Date().toISOString();

  const device = await getDeviceSnapshot();
  const lastUnlockMin = await getLastUnlockElapsedMinutes();
  if (lastUnlockMin > LAST_UNLOCK_THRESHOLD_MIN) {
    failures.push('DEVICE_FARMING_SUSPECTED');
  }

  const hasPerm = await requestLocationPermission();
  if (!hasPerm) failures.push('LOCATION_PERMISSION_DENIED');

  let gps = { latitude: 0, longitude: 0, accuracy: 9999, isMock: false };
  try {
    gps = await getGpsPosition();
  } catch {
    failures.push('GPS_UNAVAILABLE');
  }

  if (gps.accuracy > GPS_ACCURACY_THRESHOLD_M) failures.push('GPS_INACCURATE');
  if (gps.isMock) failures.push('MOCK_LOCATION_DETECTED');

  const distance = haversineDistance(
    gps.latitude,
    gps.longitude,
    branch.lat,
    branch.lng,
  );
  if (distance > branch.radius) failures.push('OUTSIDE_GEOFENCE');

  const wifi = await scanWifiWithRetry();
  if (!wifi.bssid || !branch.wifi_bssids.includes(wifi.bssid.toUpperCase())) {
    failures.push('WIFI_MISMATCH');
  }

  const vpn = await isVpnActive();
  if (vpn) failures.push('VPN_DETECTED');

  const mock = await isMockLocationActive();
  if (mock) failures.push('MOCK_LOCATION_NATIVE');

  return {
    passed: failures.length === 0,
    failures,
    snapshot: {
      wifi_bssid: wifi.bssid,
      wifi_ssid: wifi.ssid,
      latitude: gps.latitude,
      longitude: gps.longitude,
      gps_accuracy: gps.accuracy,
      is_vpn_active: vpn,
      is_mock_location: mock || gps.isMock,
      device_id: device.device_id,
      device_model: device.device_model,
      os_version: device.os_version,
      app_version: device.app_version,
      timestamp: now,
      last_unlock_elapsed_minutes: lastUnlockMin,
    },
  };
}
