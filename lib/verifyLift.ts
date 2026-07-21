/**
 * Strength trophies (Bench / Squat / Deadlift / Pull-ups / Push-ups) are
 * VIDEO-VERIFIED — they never auto-earn from a check-in. A max-lift video has
 * to be reviewed before the tier counts, so the trophy case shows the
 * requirement with no progress bar.
 *
 * This is the placeholder that the max-lift verification pipeline will replace.
 * For now it always reports "pending" so nothing unlocks a strength tier by
 * accident. When verification ships, this returns "verified" (with the
 * confirmed weight/reps) or "rejected", and useTrophyProgress feeds the result
 * into the strength stat numbers.
 */

export type LiftKind = "bench" | "squat" | "deadlift" | "pullups" | "pushups";

export type LiftVerification =
  | { status: "pending" }
  | { status: "verified"; value: number; verifiedAt: string }
  | { status: "rejected"; reason?: string };

export const STRENGTH_TROPHY_IDS: LiftKind[] = ["bench", "squat", "deadlift", "pullups", "pushups"];

export function isStrengthTrophy(id: string): id is LiftKind {
  return (STRENGTH_TROPHY_IDS as string[]).includes(id);
}

/**
 * Placeholder verifier. Real implementation will POST the max-lift video to the
 * review pipeline and return the confirmed value once approved.
 */
export async function verifyLift(_kind: LiftKind, _videoUri: string): Promise<LiftVerification> {
  return { status: "pending" };
}
