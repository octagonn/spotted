import * as Location from "expo-location";

import { isInsideGeofence, type Coordinate } from "@/lib/geofence";
import { supabase } from "@/lib/supabase";

export type GymRegion = {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
};

export async function requestForegroundLocation() {
  const result = await Location.requestForegroundPermissionsAsync();
  return result.granted;
}

/**
 * Returns the current position only when foreground permission has already
 * been granted — never prompts. Used by passive presence sync.
 */
export async function getCurrentCoordinateIfPermitted(): Promise<Coordinate | null> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) return null;
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
}

export async function getCurrentCoordinate(): Promise<Coordinate | null> {
  const granted = await requestForegroundLocation();
  if (!granted) return null;
  const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  return { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
}

export async function checkin(
  gymId: string,
  userCoordinate: Coordinate,
  gymCoordinate: Coordinate,
  radiusMeters: number
) {
  const verified = isInsideGeofence(userCoordinate, gymCoordinate, radiusMeters);
  const { data, error } = await supabase.rpc("checkin", {
    p_gym_id: gymId,
    p_latitude: userCoordinate.latitude,
    p_longitude: userCoordinate.longitude,
    p_verified: verified
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
