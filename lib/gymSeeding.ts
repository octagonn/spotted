import { logger } from "@/lib/logger";
import { supabase } from "@/lib/supabase";

// One attempt per ~1km cell per app session — seeding is idempotent server-side
// (upserts), this just avoids hammering the functions while a user pans around.
const attemptedCells = new Set<string>();

/**
 * Seed the gyms table around a location on demand (Foursquare primary, OSM
 * fallback — same order the edge functions document). The DB only contains
 * pre-seeded launch areas; without this, a user anywhere else finds an empty
 * gym picker, and since home gym became a hard onboarding gate, an empty
 * picker means they can never enter the app.
 *
 * Resolves true when a seeding call succeeded (caller should refetch).
 */
export async function seedGymsNear(latitude: number, longitude: number): Promise<boolean> {
  const cell = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  if (attemptedCells.has(cell)) return false;
  attemptedCells.add(cell);
  const body = { lat: latitude, lng: longitude, radius_m: 8000 };
  try {
    const { error } = await supabase.functions.invoke("seed-gyms-fsq", { body });
    if (!error) return true;
    throw error;
  } catch (fsqError) {
    logger.warn("seed_gyms_fsq_failed", {
      message: fsqError instanceof Error ? fsqError.message : String(fsqError)
    });
    try {
      const { error } = await supabase.functions.invoke("seed-gyms", { body });
      if (error) throw error;
      return true;
    } catch (osmError) {
      logger.warn("seed_gyms_osm_failed", {
        message: osmError instanceof Error ? osmError.message : String(osmError)
      });
      return false;
    }
  }
}
