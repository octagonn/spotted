import * as Location from "expo-location";

import { isInsideGeofence, type Coordinate } from "@/lib/geofence";
import { supabase } from "@/lib/supabase";

export type GymRegion = {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
};

export type LocatedCoordinate = Coordinate & {
  /** GPS accuracy radius in meters, when the platform reports one. */
  accuracy: number | null;
};

export async function requestForegroundLocation() {
  const result = await Location.requestForegroundPermissionsAsync();
  return result.granted;
}

/**
 * Returns the current position only when foreground permission has already
 * been granted — never prompts. Used by passive presence sync.
 *
 * Accuracy.High matters here: Balanced maps to ~100m accuracy on iOS, which
 * against a 75m gym fence made presence flap even with a perfect pin.
 */
export async function getCurrentCoordinateIfPermitted(): Promise<LocatedCoordinate | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy ?? null };
}

export async function getCurrentCoordinate(): Promise<LocatedCoordinate | null> {
  const granted = await requestForegroundLocation();
  if (!granted) return null;
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
  return { latitude: fix.coords.latitude, longitude: fix.coords.longitude, accuracy: fix.coords.accuracy ?? null };
}

export async function checkin(
  gymId: string,
  userCoordinate: Coordinate,
  gymCoordinate: Coordinate,
  radiusMeters: number,
  accuracyMeters?: number | null
) {
  const verified = isInsideGeofence(userCoordinate, gymCoordinate, radiusMeters, accuracyMeters ?? 0);
  const { data, error } = await supabase.rpc("checkin", {
    p_gym_id: gymId,
    p_latitude: userCoordinate.latitude,
    p_longitude: userCoordinate.longitude,
    p_verified: verified,
    p_accuracy_m: accuracyMeters ?? undefined
  });
  if (error) {
    throw error;
  }
  return data;
}

export async function checkout(checkinId: string) {
  const { error } = await supabase.rpc("checkout", { p_checkin_id: checkinId });
  if (error) {
    throw error;
  }
}

export type FixGymPinResult =
  | "fixed"
  | "already_accurate"
  | "too_far_from_gym"
  | "gps_too_coarse"
  | "rate_limited"
  | "no_location"
  | "error";

/**
 * Snap a gym's map pin to the user's current GPS position. Seeded pins
 * (Foursquare/OSM) are often 50-400m off the building; a member standing at
 * the gym is ground truth. The server enforces the guards (must be within
 * 600m of the current pin, GPS accuracy <= 65m, rate limits) and locks the
 * pin against being overwritten by future re-seeding.
 */
export async function fixGymPin(gymId: string): Promise<FixGymPinResult> {
  const coordinate = await getCurrentCoordinate();
  if (!coordinate) return "no_location";
  const { data, error } = await supabase.rpc("fix_gym_pin", {
    p_gym_id: gymId,
    p_latitude: coordinate.latitude,
    p_longitude: coordinate.longitude,
    p_accuracy_m: coordinate.accuracy ?? undefined
  });
  if (error) return "error";
  const known: FixGymPinResult[] = ["fixed", "already_accurate", "too_far_from_gym", "gps_too_coarse", "rate_limited"];
  return known.includes(data as FixGymPinResult) ? (data as FixGymPinResult) : "error";
}
