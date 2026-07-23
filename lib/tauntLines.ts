/**
 * Canned taunt lines — 20 rotating roasts. There is no picker anymore: the
 * Taunt button sends ONE randomly-selected line (server still enforces
 * eligibility, daily limits, and quiet hours).
 */

export type TauntLine = {
  id: string;
  text: string;
};

export const TAUNT_LINES: TauntLine[] = [
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
  { id: "bench-talk", text: "Talk to me when you bench something 🏋️" },
  { id: "squat-depth", text: "I squat deeper than your commitment 🍑" },
  { id: "deadlift-heavy", text: "The heaviest thing you lifted today was your phone 📱" },
  { id: "streak-week", text: "7 days straight. What's your excuse? 🔥" },
  { id: "wifi", text: "Your gym's wifi forgot your face 📶" },
  { id: "mirror", text: "The mirror can't flex for you 🪞" },
  { id: "calendar", text: "Your split has more holes than Swiss cheese 🧀" },
  { id: "warmup", text: "You've been 'about to go' since Monday ⏳" }
];

export const TAUNT_LINE_BY_ID: Record<string, TauntLine> = Object.fromEntries(
  TAUNT_LINES.map((line) => [line.id, line])
);

/** One random taunt from the rotation. */
export function randomTauntLine(): TauntLine {
  return TAUNT_LINES[Math.floor(Math.random() * TAUNT_LINES.length)];
}
