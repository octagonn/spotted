/**
 * Canned community-nudge lines — 20 rotating pokes. The Nudge button sends
 * ONE randomly-selected line to the crew's quiet members (server enforces
 * the one-nudge-per-24h limit and only notifies inactive members).
 */

export const NUDGE_LINES: string[] = [
  "It's been quiet in here. Too quiet.",
  "Someone post a workout before this chat collects dust.",
  "The crew's streak is on life support. Revive it.",
  "Rise and grind — this community won't hype itself.",
  "Last one to post buys the protein shakes.",
  "This crew used to lift things. Prove it still does.",
  "Your gym bag misses you. So do we.",
  "Zero posts lately. The couch is winning.",
  "Somebody wake this crew up.",
  "The group chat's asleep. The gym isn't.",
  "PRs don't hit themselves. Get in here.",
  "This community is one workout away from greatness.",
  "Quietest crew in the gym. Change that.",
  "We built this crew for gains, not silence.",
  "Post a session before the streak flatlines.",
  "The iron is calling and nobody's answering.",
  "Rest days are over. Announce your comeback.",
  "Show the crew what you lifted today.",
  "This chat needs a pump check. Now.",
  "Legends post. Everyone else lurks. Which are you?"
];

/** One random nudge from the rotation. */
export function randomNudgeLine(): string {
  return NUDGE_LINES[Math.floor(Math.random() * NUDGE_LINES.length)];
}
