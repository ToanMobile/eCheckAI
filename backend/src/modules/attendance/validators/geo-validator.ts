import { haversineDistance } from '../../../common/utils/haversine';

export interface GeoValidationResult {
  passed: boolean;
  distance?: number;
  failure?: string;
}

const MAX_GPS_ACCURACY_METERS = 50;

/**
 * Validates that the device GPS position is within the branch geofence radius.
 */
export function validateGeoFence(
  latitude: number,
  longitude: number,
  gpsAccuracy: number,
  branchLat: number,
  branchLng: number,
  radiusMeters: number,
): GeoValidationResult {
  // Reject if GPS accuracy is too poor
  if (gpsAccuracy > MAX_GPS_ACCURACY_METERS) {
    return {
      passed: false,
      failure: `GPS_ACCURACY_TOO_LOW: ${gpsAccuracy.toFixed(1)}m > ${MAX_GPS_ACCURACY_METERS}m`,
    };
  }

  const distance = haversineDistance(
    branchLat,
    branchLng,
    latitude,
    longitude,
  );

  if (distance > radiusMeters) {
    return {
      passed: false,
      distance,
      failure: `OUTSIDE_GEOFENCE: ${distance.toFixed(1)}m > ${radiusMeters}m`,
    };
  }

  return { passed: true, distance };
}
