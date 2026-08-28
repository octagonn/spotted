/**
 * Gym chains: ONE bundled logo per chain (never per gym). Detection mirrors
 * public.gym_chain_for_name() in the database, so a gym row's `chain` column
 * and this client-side fallback always agree.
 */
export type GymChain =
  | "eos"
  | "24hour"
  | "equinox"
  | "lafitness"
  | "esporta"
  | "planet"
  | "crunch"
  | "f45"
  | "anytime"
  | "orangetheory"
  | "golds"
  | "lifetime"
  | "ymca"
  | "snap"
  | "chuze"
  | "inshape"
  | "fitness19"
  | "retro"
  | "blink"
  | "youfit"
  | "clubpilates"
  | "barrys"
  | "crossfit"
  | "ufc"
  | "vasa"
  | "citysports"
  | "edge"
  | "genesis"
  | "onelife"
  | "xsport"
  | "fitnessconnection"
  | "workoutanytime"
  | "burnbootcamp"
  | "purebarre"
  | "soulcycle";

const PATTERNS: [GymChain, RegExp][] = [
  ["eos", /eos fitness|eōs/i],
  ["24hour", /24 hour fitness/i],
  ["equinox", /equinox/i],
  ["lafitness", /la fitness/i],
  ["esporta", /esporta/i],
  ["planet", /planet fitness/i],
  ["crunch", /crunch/i],
  ["f45", /\bf45\b/i],
  ["anytime", /anytime fitness/i],
  ["orangetheory", /orangetheory/i],
  ["golds", /gold's gym|golds gym/i],
  ["lifetime", /life time|lifetime fitness|lifetime athletic/i],
  ["ymca", /\bymca\b/i],
  ["snap", /snap fitness/i],
  ["chuze", /chuze/i],
  ["inshape", /in-shape|in shape/i],
  ["fitness19", /fitness 19/i],
  ["retro", /retro fitness/i],
  ["blink", /blink fitness/i],
  ["youfit", /youfit/i],
  ["clubpilates", /club pilates/i],
  ["barrys", /barry's/i],
  ["crossfit", /crossfit/i],
  ["ufc", /ufc gym/i],
  ["vasa", /\bvasa\b/i],
  ["citysports", /city sports/i],
  ["edge", /edge fitness/i],
  ["genesis", /genesis health/i],
  ["onelife", /onelife/i],
  ["xsport", /xsport/i],
  ["fitnessconnection", /fitness connection/i],
  ["workoutanytime", /workout anytime/i],
  ["burnbootcamp", /burn boot camp/i],
  ["purebarre", /pure barre/i],
  ["soulcycle", /soulcycle/i],
];

/** Chain slug for a gym name, or null for independents. */
export function detectGymChain(name: string | null | undefined): GymChain | null {
  if (!name) return null;
  for (const [chain, re] of PATTERNS) if (re.test(name)) return chain;
  return null;
}
