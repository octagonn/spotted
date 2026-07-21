/**
 * Trophy storage adapter — persists which achievements the user has already been
 * shown the unlock modal for, so a newly-earned trophy celebrates exactly once.
 * A thin wrapper over AsyncStorage; swap the body for a backend table later
 * without touching callers.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = (userId: string) => `spotted.trophies.seen.${userId}`;

export async function getSeenAchievementIds(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export async function markAchievementsSeen(userId: string, ids: string[]): Promise<void> {
  try {
    const existing = await getSeenAchievementIds(userId);
    for (const id of ids) existing.add(id);
    await AsyncStorage.setItem(KEY(userId), JSON.stringify([...existing]));
  } catch {
    // Non-fatal — worst case a trophy re-celebrates on next open.
  }
}
