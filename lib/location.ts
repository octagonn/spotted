import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";

import { isInsideGeofence, type Coordinate } from "@/lib/geofence";
import { supabase } from "@/lib/supabase";

export const GEOFENCE_TASK = "spotted-geofence";

export type GymRegion = {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
};

TaskManager.defineTask(GEOFENCE_TASK, () => Promise.resolve());

export async function requestAlwaysLocation() {
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (!foreground.granted) {
    return false;
  }
  const background = await Location.requestBackgroundPermissionsAsync();
  return background.granted;
}

export async function registerGeofences(regions: GymRegion[]) {
  const selectedRegions = regions.slice(0, 20).map((region) => ({
    identifier: region.identifier,
    latitude: region.latitude,
    longitude: region.longitude,
    radius: region.radius,
    notifyOnEnter: true,
    notifyOnExit: true
  }));
  await Location.startGeofencingAsync(GEOFENCE_TASK, selectedRegions);
}

export async function checkin(gymId: string, userCoordinate: Coordinate, gymCoordinate: Coordinate, radiusMeters: number) {
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
