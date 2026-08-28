import type { ImageSource } from "expo-image";

import { detectGymChain, type GymChain } from "@/lib/gymChainDetect";
import { INSTITUTION_LOGOS } from "@/lib/institutionLogos";

export { detectGymChain, type GymChain } from "@/lib/gymChainDetect";
/** Bundled logos — only chains we actually have art for. */
export const GYM_CHAIN_LOGOS: Partial<Record<GymChain, ImageSource>> = {
  "24hour": require("../assets/gym-logos/24hour.png"),
  "anytime": require("../assets/gym-logos/anytime.png"),
  "barrys": require("../assets/gym-logos/barrys.png"),
  "blink": require("../assets/gym-logos/blink.png"),
  "burnbootcamp": require("../assets/gym-logos/burnbootcamp.png"),
  "chuze": require("../assets/gym-logos/chuze.png"),
  "citysports": require("../assets/gym-logos/citysports.png"),
  "clubpilates": require("../assets/gym-logos/clubpilates.png"),
  "crossfit": require("../assets/gym-logos/crossfit.png"),
  "crunch": require("../assets/gym-logos/crunch.png"),
  "edge": require("../assets/gym-logos/edge.png"),
  "eos": require("../assets/gym-logos/eos.png"),
  "equinox": require("../assets/gym-logos/equinox.png"),
  "esporta": require("../assets/gym-logos/esporta.png"),
  "f45": require("../assets/gym-logos/f45.png"),
  "fitness19": require("../assets/gym-logos/fitness19.png"),
  "fitnessconnection": require("../assets/gym-logos/fitnessconnection.png"),
  "genesis": require("../assets/gym-logos/genesis.png"),
  "golds": require("../assets/gym-logos/golds.png"),
  "inshape": require("../assets/gym-logos/inshape.png"),
  "lafitness": require("../assets/gym-logos/lafitness.png"),
  "lifetime": require("../assets/gym-logos/lifetime.png"),
  "onelife": require("../assets/gym-logos/onelife.png"),
  "orangetheory": require("../assets/gym-logos/orangetheory.png"),
  "planet": require("../assets/gym-logos/planet.png"),
  "purebarre": require("../assets/gym-logos/purebarre.png"),
  "retro": require("../assets/gym-logos/retro.png"),
  "snap": require("../assets/gym-logos/snap.png"),
  "soulcycle": require("../assets/gym-logos/soulcycle.png"),
  "ufc": require("../assets/gym-logos/ufc.png"),
  "vasa": require("../assets/gym-logos/vasa.png"),
  "workoutanytime": require("../assets/gym-logos/workoutanytime.png"),
  "ymca": require("../assets/gym-logos/ymca.png"),
  "youfit": require("../assets/gym-logos/youfit.png"),
};

/**
 * Logos sourced as full-bleed brand squares (already on their own background)
 * render edge-to-edge; the rest are transparent wordmarks/marks that sit on a
 * white disc with padding so they fit completely inside the tile.
 */
export const GYM_CHAIN_FULL_BLEED: ReadonlySet<GymChain> = new Set<GymChain>([
  "eos",
  "ufc",
  "esporta",
  "onelife",
  "edge",
  "genesis"
]);

export function gymChainOf(gym: { chain?: string | null; name?: string | null }): GymChain | null {
  return (gym.chain as GymChain | null | undefined) ?? detectGymChain(gym.name);
}

export type GymBrandRef = { chain?: string | null; institution?: string | null; name?: string | null };

/**
 * Logo for a gym: the campus institution (rec centers, intramural buildings)
 * first, then the chain (stored slug, else detected from the name).
 */
export function gymLogo(gym: GymBrandRef): ImageSource | null {
  if (gym.institution && INSTITUTION_LOGOS[gym.institution]) return INSTITUTION_LOGOS[gym.institution];
  const chain = gymChainOf(gym);
  return chain ? (GYM_CHAIN_LOGOS[chain] ?? null) : null;
}

/** Institution logos are seals/wordmarks on transparent backgrounds → padded on a white disc. */
export function gymLogoIsFullBleed(gym: GymBrandRef): boolean {
  if (gym.institution && INSTITUTION_LOGOS[gym.institution]) return false;
  const chain = gymChainOf(gym);
  return chain ? GYM_CHAIN_FULL_BLEED.has(chain) : false;
}
