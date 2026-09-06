/** Shared compose-flow types for the camera screen and its sheets. */

export type Mode = "daily" | "lift";

/** Where the post happened: a real mapped gym row, or an unmapped location. */
export type SelectedGym = { type: "gym"; id: string; name: string } | { type: "home" } | { type: "other" };

/** Hard geofence for posting a gym photo: 0.2 miles. */
export const GYM_GEOFENCE_METERS = 0.2 * 1609.344;

export function gymName(gym: SelectedGym | null): string | null {
  if (!gym) return null;
  if (gym.type === "home") return "Custom location";
  if (gym.type === "other") return "Other location";
  return gym.name;
}
