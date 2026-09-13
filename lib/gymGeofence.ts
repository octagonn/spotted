import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";

import { isInsideGeofence, type Coordinate } from "@/lib/geofence";
import { checkin, checkout } from "@/lib/location";
import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";
import { usePresenceStore } from "@/stores/presence";

/**
 * Background gym-arrival detection, the Life360 way: no continuous GPS.
 *
 * 1. The home gym is registered as ONE OS geofence (iOS region monitoring /
 *    Android Geofencing API). The OS watches it with cell/Wi-Fi power and wakes
 *    the app — even if it was killed — when the phone crosses the boundary.
 * 2. iOS regions are only reliable at >= ~150 m, so the OS fence is wider than
 *    the gym's 75 m presence fence. On ENTER we start a short "settle" stream of
 *    real GPS fixes; the first fix inside the REAL fence calls the `checkin`
 *    RPC (server re-verifies distance, dedupes open check-ins, and its trigger
 *    sends the arrival push). The stream stops as soon as we're in, on EXIT, or
 *    after SETTLE_TIMEOUT_MS — so GPS only runs for the minutes between
 *    "near the gym" and "inside the gym".
 * 3. EXIT takes one fix; if it agrees we've left, the open check-in is closed.
 *
 * Everything here is gated on a binary that compiled the background mode in
 * (>= 1.3.0) and wrapped in try/catch: an OTA can never break an older build.
 */

export const GYM_GEOFENCE_TASK = "spotted-gym-geofence";
const GYM_SETTLE_TASK = "spotted-gym-settle";

/** Below this iOS region monitoring gets flaky; fence wider, verify with GPS. */
const MIN_OS_RADIUS_METERS = 150;
/** Give up waiting to "settle" inside the real fence after this long. */
const SETTLE_TIMEOUT_MS = 15 * 60 * 1000;
const MIN_NATIVE_VERSION = "1.3.0";

const FENCED_GYM_KEY = "gym-geofence:fenced-gym";
const SETTLE_STARTED_KEY = "gym-geofence:settle-started-at";
const ASKED_KEY_PREFIX = "gym-geofence:always-asked:";

export type FencedGym = Coordinate & { id: string; radius: number };
export type BackgroundLocationStatus = "granted" | "denied" | "not_asked" | "unavailable";

type GeofenceTaskData = { eventType: Location.GeofencingEventType; region: Location.LocationRegion };
type SettleTaskData = { locations: Location.LocationObject[] };

function compareVersions(a: string, b: string) {
  const pa = a.split(".").map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split(".").map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/**
 * True only on a store/dev binary built with UIBackgroundModes=location and
 * the background permissions (app.config >= 1.3.0). Expo Go is excluded — it
 * can't run background location for third-party tasks.
 */
export function nativeSupportsBackgroundLocation() {
  if (Platform.OS === "web") return false;
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return false;
  const version = Constants.nativeAppVersion;
  if (!version) return false;
  return compareVersions(version, MIN_NATIVE_VERSION) >= 0;
}

export async function getBackgroundLocationStatus(): Promise<BackgroundLocationStatus> {
  if (!nativeSupportsBackgroundLocation()) return "unavailable";
  try {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (bg.granted) return "granted";
    // iOS reports canAskAgain=false once the user has answered; Android after
    // "don't ask again". Either way only the Settings app can change it now.
    return bg.status === Location.PermissionStatus.UNDETERMINED || bg.canAskAgain ? "not_asked" : "denied";
  } catch {
    return "unavailable";
  }
}

/**
 * Foreground → background ("Always") permission chain. Must be called while
 * the app is active. On iOS 13+ the OS may grant a *provisional* Always and
 * show its own "Keep Only While Using / Change to Always Allow" prompt later,
 * the first time the geofence actually fires — that's expected.
 */
export async function ensureBackgroundLocation(): Promise<BackgroundLocationStatus> {
  if (!nativeSupportsBackgroundLocation()) return "unavailable";
  try {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (!fg.granted) return "denied";
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.granted ? "granted" : "denied";
  } catch (error) {
    logger.warn("background_location_request_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    return "unavailable";
  }
}

/** One-shot flag so existing users are asked to upgrade to Always only once. */
export async function shouldOfferBackgroundLocation(userId: string) {
  if (!nativeSupportsBackgroundLocation()) return false;
  if ((await getBackgroundLocationStatus()) !== "not_asked") return false;
  return (await AsyncStorage.getItem(ASKED_KEY_PREFIX + userId)) === null;
}

export async function markBackgroundLocationOffered(userId: string) {
  await AsyncStorage.setItem(ASKED_KEY_PREFIX + userId, String(Date.now())).catch(() => undefined);
}

async function readFencedGym(): Promise<FencedGym | null> {
  try {
    const raw = await AsyncStorage.getItem(FENCED_GYM_KEY);
    return raw ? (JSON.parse(raw) as FencedGym) : null;
  } catch {
    return null;
  }
}

/**
 * Register (or refresh) the OS geofence for the user's home gym. Idempotent —
 * call it whenever the home gym is (re)resolved. Passing null, or lacking the
 * Always permission, tears the fence down.
 */
export async function syncGymGeofence(gym: FencedGym | null): Promise<void> {
  if (!nativeSupportsBackgroundLocation()) return;
  try {
    const bg = await Location.getBackgroundPermissionsAsync();
    if (!gym || !bg.granted) {
      await teardownGymGeofence();
      return;
    }
    const previous = await readFencedGym();
    const started = await Location.hasStartedGeofencingAsync(GYM_GEOFENCE_TASK);
    const unchanged =
      previous?.id === gym.id &&
      previous.latitude === gym.latitude &&
      previous.longitude === gym.longitude &&
      previous.radius === gym.radius;
    if (started && unchanged) return;

    await AsyncStorage.setItem(FENCED_GYM_KEY, JSON.stringify(gym));
    await Location.startGeofencingAsync(GYM_GEOFENCE_TASK, [
      {
        identifier: gym.id,
        latitude: gym.latitude,
        longitude: gym.longitude,
        radius: Math.max(gym.radius + 50, MIN_OS_RADIUS_METERS),
        notifyOnEnter: true,
        notifyOnExit: true
      }
    ]);
    logger.info("gym_geofence_armed", { gymId: gym.id });
  } catch (error) {
    logger.warn("gym_geofence_sync_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

/** Re-arm after the home gym changes, without waiting for the next foreground sync. */
export async function syncGymGeofenceById(gymId: string | null): Promise<void> {
  if (!nativeSupportsBackgroundLocation()) return;
  if (!gymId) {
    await syncGymGeofence(null);
    return;
  }
  const { data: gym } = await supabase
    .from("gyms")
    .select("id, latitude, longitude, geofence_radius_meters")
    .eq("id", gymId)
    .maybeSingle();
  if (!gym) return;
  await syncGymGeofence({
    id: gym.id,
    latitude: gym.latitude,
    longitude: gym.longitude,
    radius: gym.geofence_radius_meters
  });
}

export async function teardownGymGeofence(): Promise<void> {
  try {
    await stopSettle();
    if (await Location.hasStartedGeofencingAsync(GYM_GEOFENCE_TASK)) {
      await Location.stopGeofencingAsync(GYM_GEOFENCE_TASK);
    }
    await AsyncStorage.removeItem(FENCED_GYM_KEY);
  } catch (error) {
    logger.warn("gym_geofence_teardown_failed", {
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

// ---------------------------------------------------------------------------
// Headless task bodies. These run with NO React tree mounted (the OS launched
// the JS bundle just for them), so everything comes from AsyncStorage + the
// persisted Supabase session.
// ---------------------------------------------------------------------------

async function sessionUserId(): Promise<string | null> {
  // getSession() refreshes an expired token, which can be the case after the
  // phone sat in a pocket for hours.
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function startSettle() {
  if (await Location.hasStartedLocationUpdatesAsync(GYM_SETTLE_TASK)) return;
  await AsyncStorage.setItem(SETTLE_STARTED_KEY, String(Date.now()));
  await Location.startLocationUpdatesAsync(GYM_SETTLE_TASK, {
    accuracy: Location.Accuracy.High,
    distanceInterval: 15,
    timeInterval: 10_000,
    pausesUpdatesAutomatically: false,
    activityType: Location.LocationActivityType.Fitness,
    showsBackgroundLocationIndicator: false,
    // Android requires a visible foreground service for background GPS.
    foregroundService: {
      notificationTitle: "Spotted",
      notificationBody: "Confirming you made it to the gym.",
      killServiceOnDestroy: true
    }
  });
}

async function stopSettle() {
  await AsyncStorage.removeItem(SETTLE_STARTED_KEY);
  if (await Location.hasStartedLocationUpdatesAsync(GYM_SETTLE_TASK)) {
    await Location.stopLocationUpdatesAsync(GYM_SETTLE_TASK);
  }
}

async function arrive(gym: FencedGym, coordinate: Coordinate, accuracy: number | null) {
  const checkinId = await checkin(gym.id, coordinate, gym, gym.radius, accuracy);
  usePresenceStore.getState().setAtGym(true, gym.id, checkinId ?? null);
  logger.info("gym_geofence_checkin", { gymId: gym.id, source: "background" });
}

async function leave(gym: FencedGym, userId: string) {
  const { data: open } = await supabase
    .from("checkins")
    .select("id")
    .eq("user_id", userId)
    .eq("gym_id", gym.id)
    .is("checked_out_at", null);
  for (const row of open ?? []) {
    await checkout(row.id);
  }
  usePresenceStore.getState().setAtGym(false, null, null);
  logger.info("gym_geofence_checkout", { gymId: gym.id, closed: open?.length ?? 0 });
}

async function onGeofenceEvent(data: GeofenceTaskData) {
  const gym = await readFencedGym();
  if (!gym || data.region.identifier !== gym.id) return;
  const userId = await sessionUserId();
  if (!userId) {
    await teardownGymGeofence();
    return;
  }

  if (data.eventType === Location.GeofencingEventType.Enter) {
    // Don't take a fix here: iOS gives ~10 s after a region wake. The settle
    // stream keeps the app alive and does the verified check-in itself.
    await startSettle();
    return;
  }

  if (data.eventType === Location.GeofencingEventType.Exit) {
    await stopSettle();
    // A single bad fix inside a big building can fake an exit; only trust it
    // when GPS agrees we're outside the real fence.
    try {
      const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (isInsideGeofence(fix.coords, gym, gym.radius, fix.coords.accuracy ?? 0)) return;
    } catch {
      // No fix available — the OS exit is the best information we have.
    }
    await leave(gym, userId);
  }
}

async function onSettleLocations(data: SettleTaskData) {
  const gym = await readFencedGym();
  const startedAt = Number(await AsyncStorage.getItem(SETTLE_STARTED_KEY)) || 0;
  if (!gym || Date.now() - startedAt > SETTLE_TIMEOUT_MS) {
    await stopSettle();
    return;
  }
  const latest = data.locations[data.locations.length - 1];
  if (!latest) return;
  const accuracy = latest.coords.accuracy ?? 0;
  if (!isInsideGeofence(latest.coords, gym, gym.radius, accuracy)) return;

  const userId = await sessionUserId();
  if (!userId) {
    await teardownGymGeofence();
    return;
  }
  await arrive(gym, latest.coords, latest.coords.accuracy ?? null);
  await stopSettle();
}

// defineTask must run at module scope, before React renders, so the task
// exists when the OS cold-launches the bundle in the background. The root
// layout imports this module for that side effect.
if (Platform.OS !== "web") {
  TaskManager.defineTask<GeofenceTaskData>(GYM_GEOFENCE_TASK, async ({ data, error }) => {
    if (error || !data) {
      logger.warn("gym_geofence_task_error", { message: error?.message ?? "no data" });
      return;
    }
    try {
      await onGeofenceEvent(data);
    } catch (caught) {
      logger.warn("gym_geofence_task_failed", {
        message: caught instanceof Error ? caught.message : String(caught)
      });
    }
  });

  TaskManager.defineTask<SettleTaskData>(GYM_SETTLE_TASK, async ({ data, error }) => {
    if (error || !data) {
      await stopSettle().catch(() => undefined);
      return;
    }
    try {
      await onSettleLocations(data);
    } catch (caught) {
      logger.warn("gym_settle_task_failed", {
        message: caught instanceof Error ? caught.message : String(caught)
      });
    }
  });
}
