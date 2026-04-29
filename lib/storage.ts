import { MMKV } from "react-native-mmkv";

const storage = new MMKV({
  id: "spotted-cache"
});

export function setCacheItem(key: string, value: string) {
  storage.set(key, value);
}

export function getCacheItem(key: string) {
  return storage.getString(key) ?? null;
}

export function setCacheBoolean(key: string, value: boolean) {
  storage.set(key, value);
}

export function getCacheBoolean(key: string) {
  return storage.getBoolean(key) ?? false;
}
