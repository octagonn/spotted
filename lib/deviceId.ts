import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "spotted-device-id";

/**
 * A stable, app-local pseudo-random device identifier used only for the
 * age-gate retry block (§1). It is hashed server-side before storage and is
 * never tied to any hardware identifier — good enough to make casual retries
 * from the same install fail, without collecting a real device ID.
 */
export async function getDeviceId(): Promise<string> {
  try {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing) return existing;
    const id = `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    await AsyncStorage.setItem(KEY, id);
    return id;
  } catch {
    return "";
  }
}
