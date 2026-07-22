/**
 * Canned taunt lines (spec B). Base set is always available; extra lines are
 * gated behind specific trophies — shown locked in the picker with the trophy
 * name, doubling as trophy advertising.
 */

export type TauntLine = {
  id: string;
  text: string;
  /** Trophy family id that unlocks this line (undefined = base set). */
  requiresTrophy?: string;
  /** Human name of the gating trophy, shown on the locked row. */
  requiresTrophyName?: string;
};

export const TAUNT_LINES: TauntLine[] = [
  // ---- Base set ----
  { id: "couch", text: "The couch won today 🛋️" },
  { id: "gym-misses-you", text: "Gym said it misses you 😂" },
  { id: "rest-year", text: "Legs day? More like rest year 💀" },
  { id: "alarm", text: "Your alarm called. It gave up too ⏰" },
  { id: "dust", text: "Your gym card is collecting dust 🕸️" },
  { id: "excuses", text: "Excuses don't build muscle 🧠" },
  { id: "watching", text: "We're all posting. You're all watching 👀" },
  { id: "shoes", text: "Your lifting shoes filed a missing person report 👟" },
  { id: "protein", text: "That protein shake isn't gonna earn itself 🥤" },
  { id: "streak-alive", text: "My streak's alive. Yours is a ghost 👻" },
  { id: "day-off", text: "Another 'rest day'? Bold strategy 📉" },
  { id: "spotted", text: "You've been SPOTTED slacking 📸" },
  // ---- Trophy-gated ----
  { id: "bench-talk", text: "Talk to me when you bench something 🏋️", requiresTrophy: "bench", requiresTrophyName: "Bench trophies" },
  { id: "squat-depth", text: "I squat deeper than your commitment 🍑", requiresTrophy: "squat", requiresTrophyName: "Squat trophies" },
  { id: "deadlift-heavy", text: "The heaviest thing you lifted today was your phone 📱", requiresTrophy: "deadlift", requiresTrophyName: "Deadlift trophies" },
  { id: "streak-week", text: "7 days straight. What's your excuse? 🔥", requiresTrophy: "streak", requiresTrophyName: "Streak trophies" }
];

export const TAUNT_LINE_BY_ID: Record<string, TauntLine> = Object.fromEntries(
  TAUNT_LINES.map((line) => [line.id, line])
);
