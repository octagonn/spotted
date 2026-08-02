import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

export type SavePhotoResult = "saved" | "denied" | "unavailable";

/**
 * Save one local image to the user's camera roll.
 *
 * Permission is requested only after the user taps Save, and write-only access
 * is used so Spotted never gains broad read access to their library.
 */
export async function savePhotoToCameraRoll(uri: string | null | undefined): Promise<SavePhotoResult> {
  if (!uri || Platform.OS === "web") return "unavailable";

  const available = await MediaLibrary.isAvailableAsync();
  if (!available) return "unavailable";

  const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
  if (!permission.granted) return "denied";

  await MediaLibrary.saveToLibraryAsync(uri);
  return "saved";
}
