import { create } from "zustand";

/**
 * Session-local state for the MOCK inbox threads (spec §5.1/§5.2):
 * - unread flags clear when a thread is opened;
 * - sending in a mock conversation appends the bubble locally and updates the
 *   inbox preview to `You: {text}` with time `now`.
 *
 * Real conversations don't touch this store — they go through
 * hooks/queries/useMessages.ts and the server-side read markers.
 */

type ThreadOverride = {
  preview?: string;
  time?: string;
  /** Explicit unread override (false once opened). */
  unread?: boolean;
};

type MockChatState = {
  overrides: Record<string, ThreadOverride>;
  /** Locally appended "mine" messages per mock thread, in send order. */
  sentMessages: Record<string, string[]>;
  /** Clear a mock thread's unread dot (row tap, §5.1). */
  markRead: (threadId: string) => void;
  /** Append my message + update the inbox preview to `You: {text}` / `now` (§5.2). */
  sendLocal: (threadId: string, text: string) => void;
};

export const useMockChatStore = create<MockChatState>((set) => ({
  overrides: {},
  sentMessages: {},
  markRead: (threadId) =>
    set((state) => ({
      overrides: {
        ...state.overrides,
        [threadId]: { ...state.overrides[threadId], unread: false }
      }
    })),
  sendLocal: (threadId, text) =>
    set((state) => ({
      overrides: {
        ...state.overrides,
        [threadId]: { preview: `You: ${text}`, time: "now", unread: false }
      },
      sentMessages: {
        ...state.sentMessages,
        [threadId]: [...(state.sentMessages[threadId] ?? []), text]
      }
    }))
}));
