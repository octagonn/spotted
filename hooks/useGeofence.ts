import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { isInsideGeofence } from "@/lib/geofence";
import { checkin, checkout, getCurrentCoordinateIfPermitted } from "@/lib/location";
import { logger } from "@/lib/logger";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { usePresenceStore } from "@/stores/presence";

export function useGeofence() {
  const manualCheckin = useMutation({
    mutationFn: async (payload: {
      gymId: string;
      userLatitude: number;
      userLongitude: number;
      gymLatitude: number;
      gymLongitude: number;
      radiusMeters: number;
    }) =>
      checkin(
        payload.gymId,
        { latitude: payload.userLatitude, longitude: payload.userLongitude },
        { latitude: payload.gymLatitude, longitude: payload.gymLongitude },
        payload.radiusMeters
      )
  });

  return { manualCheckin };
}

/**
 * Foreground presence sync: on app start and whenever the app returns to the
 * foreground, if location permission is already granted, compare the current
 * position against the user's home-gym geofence and check in / out via the
 * server RPCs. Updates the presence store so the tab-bar ring is honest.
 */
export function usePresenceSync() {
  const status = useAuthStore((state) => state.status);
  const userId = useAuthStore((state) => state.userId);
  const syncing = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured || status !== "ready" || !userId || Platform.OS === "web") {
      return;
    }

    async function sync() {
      if (syncing.current) return;
      syncing.current = true;
      try {
        const { atGym, activeGymId, activeCheckinId, setAtGym } = usePresenceStore.getState();
        const coordinate = await getCurrentCoordinateIfPermitted();
        if (!coordinate) return;

        const { data: profile } = await supabase
          .from("profiles")
          .select("home_gym_id")
          .eq("id", userId as string)
          .maybeSingle();
        const homeGymId = profile?.home_gym_id;
        if (!homeGymId) {
          if (atGym) {
            if (activeCheckinId) await checkout(activeCheckinId);
            setAtGym(false, null, null);
          }
          return;
        }

        const { data: gym } = await supabase
          .from("gyms")
          .select("id, latitude, longitude, geofence_radius_meters")
          .eq("id", homeGymId)
          .maybeSingle();
        if (!gym) return;

        const inside = isInsideGeofence(
          coordinate,
          { latitude: gym.latitude, longitude: gym.longitude },
          gym.geofence_radius_meters
        );

        if (inside && (!atGym || activeGymId !== gym.id)) {
          const checkinId = await checkin(
            gym.id,
            coordinate,
            { latitude: gym.latitude, longitude: gym.longitude },
            gym.geofence_radius_meters
          );
          setAtGym(true, gym.id, checkinId ?? null);
        } else if (!inside && atGym) {
          if (activeCheckinId) await checkout(activeCheckinId);
          setAtGym(false, null, null);
        }
      } catch (error) {
        logger.warn("presence_sync_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      } finally {
        syncing.current = false;
      }
    }

    void sync();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void sync();
      }
    });
    return () => subscription.remove();
  }, [status, userId]);
}
