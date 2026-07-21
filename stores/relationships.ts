import { create } from "zustand";

import { FIND_PEOPLE } from "@/lib/redesignData";
import { showToast } from "@/stores/ui";
import type { RelationshipState } from "@/types/redesign";

/**
 * Relationship state machine (spec §5.3) — `none | requested | incoming | friend | following`.
 *
 * Session-local zustand store keyed by person id (mock fixture id or real profile id).
 * Seeded from the FIND_PEOPLE fixtures; real people are seeded lazily via `seed()`
 * when their hook data arrives. Both the Find Friends list and the other-user
 * profile panel (`app/user/[username]`) subscribe here so a state change
 * re-renders every open surface (§5.3 "re-render list and any open profile
 * panel's button").
 *
 * Consumed by the PROFILE agent via `useRelationships()`.
 */

type RelationshipsStore = {
  states: Record<string, RelationshipState>;
  /** Set a person's state unconditionally. */
  setRelationship: (id: string, state: RelationshipState) => void;
  /** Seed a person's initial state — no-op if the id is already tracked. */
  seed: (id: string, state: RelationshipState) => void;
  /** Drop all learned relationship state (on account switch). */
  reset: () => void;
};

const seededFromFixtures: Record<string, RelationshipState> = {};
for (const person of FIND_PEOPLE) {
  seededFromFixtures[person.id] = person.state;
  // Fixture people are also addressable by handle (user/[username] routes use it).
  seededFromFixtures[person.handle] = person.state;
}

export const useRelationshipsStore = create<RelationshipsStore>((set) => ({
  states: seededFromFixtures,
  setRelationship: (id, state) => set((prev) => ({ states: { ...prev.states, [id]: state } })),
  seed: (id, state) =>
    set((prev) => (id in prev.states ? prev : { states: { ...prev.states, [id]: state } })),
  reset: () => set({ states: { ...seededFromFixtures } })
}));

/** RelButton presentation for a relationship state (§5.3 / §2.2). */
export function relationshipButton(state: RelationshipState): {
  label: string;
  kind: "primary" | "quiet";
  disabled: boolean;
} {
  switch (state) {
    case "friend":
      return { label: "✓ Friends", kind: "quiet", disabled: true };
    case "following":
      return { label: "Following", kind: "quiet", disabled: false };
    case "requested":
      return { label: "Added", kind: "quiet", disabled: false };
    case "incoming":
      return { label: "Add Back", kind: "primary", disabled: false };
    case "none":
    default:
      return { label: "Add", kind: "primary", disabled: false };
  }
}

export type RelationshipTransition = { from: RelationshipState; to: RelationshipState };

/**
 * Advance a person's relationship one step (§5.3 exact transitions + toasts):
 * - none → requested, toast `Friend request sent`
 * - requested → none, toast `Request withdrawn`
 * - incoming → friend, toast `You and {Name} are now friends`
 * - following → none, toast `Unfollowed`
 * - friend → no-op (pill is non-interactive)
 *
 * `name` is the person's display name; the toast uses their first name,
 * matching the mockup. Returns the transition, or null when nothing changed —
 * callers wire real backend mutations off the returned transition.
 */
export function advanceRelationship(id: string, name: string): RelationshipTransition | null {
  const { states, setRelationship } = useRelationshipsStore.getState();
  const from = states[id] ?? "none";
  const firstName = name.trim().split(/\s+/)[0] ?? name;

  let to: RelationshipState;
  switch (from) {
    case "none":
      to = "requested";
      showToast("Friend request sent");
      break;
    case "requested":
      to = "none";
      showToast("Request withdrawn");
      break;
    case "incoming":
      to = "friend";
      showToast(`You and ${firstName} are now friends`);
      break;
    case "following":
      to = "none";
      showToast("Unfollowed");
      break;
    case "friend":
    default:
      return null;
  }

  setRelationship(id, to);
  return { from, to };
}

export type RelationshipsApi = {
  /** Full id → state map (subscribing to it re-renders on any change). */
  states: Record<string, RelationshipState>;
  /** Current state for a person; `fallback` (default "none") when untracked. */
  stateFor: (id: string, fallback?: RelationshipState) => RelationshipState;
  /** Seed an initial state for a real person — no-op if already tracked. */
  seed: (id: string, state: RelationshipState) => void;
  /** Force a state (e.g. syncing with a server response). */
  setRelationship: (id: string, state: RelationshipState) => void;
  /** Run the §5.3 transition + toast. Returns the transition or null. */
  advance: (id: string, name: string) => RelationshipTransition | null;
};

/** Hook façade over the store — the API other agents (PROFILE) consume. */
export function useRelationships(): RelationshipsApi {
  const states = useRelationshipsStore((store) => store.states);
  const seed = useRelationshipsStore((store) => store.seed);
  const setRelationship = useRelationshipsStore((store) => store.setRelationship);
  return {
    states,
    stateFor: (id, fallback = "none") => states[id] ?? fallback,
    seed,
    setRelationship,
    advance: advanceRelationship
  };
}
