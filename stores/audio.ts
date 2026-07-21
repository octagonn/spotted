import { create } from "zustand";

type AudioState = {
  /** Global feed mute — shared across every autoplaying video and music post. */
  muted: boolean;
  /** Bumps on each toggle so the tapped post can flash a speaker indicator. */
  nonce: number;
  toggleMuted: () => void;
};

/**
 * One mute switch for the whole feed (Instagram-style): muting any video or
 * music post mutes them all until the user unmutes again.
 */
export const useAudioStore = create<AudioState>((set) => ({
  muted: false,
  nonce: 0,
  toggleMuted: () => set((s) => ({ muted: !s.muted, nonce: s.nonce + 1 }))
}));
