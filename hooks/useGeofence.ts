import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { appAlert } from "@/components/ui/AppDialog";
import { isInsideGeofence } from "@/lib/geofence";
import {
  ensureBackgroundLocation,
  markBackgroundLocationOffered,
  shouldOfferBackgroundLocation,
  syncGymGeofence,
  type FencedGym
} from "@/lib/gymGeofence";
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
 * Offer the "Always" location upgrade exactly once, at the moment it makes
 * the most sense — the user just got checked in by opening the app at the gym,
 * which is the exact thing background detection would have done for them.
 */
async function offerBackgroundLocation(userId: string, gym: FencedGym) {
  if (!(await shouldOfferBackgroundLocation(userId))) return;
  await markBackgroundLocationOffered(userId);
  appAlert(
    "Get the buzz without opening the app",
    "Allow location “Always” and Spotted checks you in the moment you walk into your gym. It uses a single low-power geofence, not GPS tracking — no location history is kept.",
    [
      { text: "Not now", style: "cancel" },
      {
        text: "Turn on",
        onPress: () => {
          void ensureBackgroundLocation().then((result) => {
            if (result === "granted") void syncGymGeofence(gym);
          });
        }
      }
    ]
  );
}

/**
 * Foreground presence sync: on app start and whenever the app returns to the
 * foreground, if location permission is already granted, compare the current
 * position against the user's home-gym geofence and check in / out via the
 * server RPCs. Updates the presence store so the tab-bar ring is honest.
 *
 * Also keeps the background OS geofence (lib/gymGeofence) pointed at the
 * current home gym, so arrivals are detected with the app closed.
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
          void syncGymGeofence(null);
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

        const fenced: FencedGym = {
          id: gym.id,
          latitude: gym.latitude,
          longitude: gym.longitude,
          radius: gym.geofence_radius_meters
        };
        void syncGymGeofence(fenced);

        const inside = isInsideGeofence(
          coordinate,
          { latitude: gym.latitude, longitude: gym.longitude },
          gym.geofence_radius_meters,
          coordinate.accuracy ?? 0
        );

        if (inside && (!atGym || activeGymId !== gym.id)) {
          const checkinId = await checkin(
            gym.id,
            coordinate,
            { latitude: gym.latitude, longitude: gym.longitude },
            gym.geofence_radius_meters,
            coordinate.accuracy
          );
          setAtGym(true, gym.id, checkinId ?? null);
          void offerBackgroundLocation(userId as string, fenced);
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
