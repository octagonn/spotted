import { INBOX_THREADS } from "@/lib/redesignData";
import { isDemoMode } from "@/lib/supabase";
import type { InboxThread } from "@/types/redesign";

/**
 * Seed conversations for the mock inbox threads (spec §5.2) — bubbles + time
 * separators mirror the prototype's CONVOS fixture, mapped onto the
 * INBOX_THREADS people from lib/redesignData.ts.
 */

export type MockConversationItem =
  /** Centered time separator, e.g. "Today 8:02 AM", "Yesterday", "Monday". */
  | { kind: "sep"; label: string }
  /** A bubble. `mine` = right-aligned white bubble; `senderFirst` = group sender name. */
  | { kind: "msg"; mine: boolean; text: string; senderFirst?: string };

export type MockConversation = {
  threadId: string;
  /** Panel head title — user's full name or group name. */
  title: string;
  /** Panel head sub — handle for DMs, member list for groups. */
  sub: string;
  group: boolean;
  seed: MockConversationItem[];
};

export const MOCK_CONVERSATIONS: Record<string, MockConversation> = {
  "th-mia": {
    threadId: "th-mia",
    title: "Mia Chen",
    sub: "@mia_lifts",
    group: false,
    seed: [
      { kind: "sep", label: "Today 8:02 AM" },
      { kind: "msg", mine: false, text: "You hitting Gold's at 6?" },
      { kind: "msg", mine: true, text: "Yeah, pull day" },
      { kind: "msg", mine: false, text: "Bet. Save me a rack" }
    ]
  },
  "th-legday": {
    threadId: "th-legday",
    title: "Leg Day Crew",
    sub: "Jordan, Sam, You",
    group: true,
    seed: [
      { kind: "sep", label: "Today 7:44 AM" },
      { kind: "msg", mine: false, text: "Thursday still on?", senderFirst: "Sam" },
      { kind: "msg", mine: false, text: "squats then we eat", senderFirst: "Jordan" },
      { kind: "msg", mine: true, text: "I'm in. Front squats tho" },
      { kind: "msg", mine: false, text: "Brave", senderFirst: "Sam" }
    ]
  },
  "th-alex": {
    threadId: "th-alex",
    title: "Alex Moore",
    sub: "@alexbench",
    group: false,
    seed: [
      { kind: "sep", label: "Yesterday" },
      { kind: "msg", mine: false, text: "That bench PR was clean" },
      { kind: "msg", mine: true, text: "Third attempt too 😮‍💨" },
      { kind: "msg", mine: false, text: "Video did numbers in the community" }
    ]
  },
  "th-5am": {
    threadId: "th-5am",
    title: "5AM Club",
    sub: "Octavio, Mia, +3",
    group: true,
    seed: [
      { kind: "sep", label: "Today 4:31 AM" },
      { kind: "msg", mine: false, text: "doors at 4:55, no excuses", senderFirst: "Octavio" },
      { kind: "msg", mine: false, text: "already in the car", senderFirst: "Mia" },
      { kind: "msg", mine: true, text: "omw" }
    ]
  },
  "th-sam": {
    threadId: "th-sam",
    title: "Sam Rivera",
    sub: "@sam_deload",
    group: false,
    seed: [
      { kind: "sep", label: "Monday" },
      { kind: "msg", mine: false, text: "Sent you the deload plan" },
      { kind: "msg", mine: true, text: "Got it, starting next week" }
    ]
  }
};

/** True when a /chat/[id] param addresses a mock inbox thread (vs a real profile id). */
export function isMockThreadId(id: string | undefined): id is keyof typeof MOCK_CONVERSATIONS {
  // Mock threads are dev-demo-only; a release bundle never resolves one.
  return isDemoMode && Boolean(id && id in MOCK_CONVERSATIONS);
}

/** Inbox fixture row for a mock thread id. */
export function mockThreadById(id: string): InboxThread | undefined {
  return INBOX_THREADS.find((thread) => thread.id === id);
}
