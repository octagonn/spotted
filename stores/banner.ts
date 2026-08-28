import { create } from "zustand";

export type InAppBanner = {
  id: string;
  title: string;
  body: string;
  avatarName: string;
  avatarUrl: string | null;
  /** Route to open when tapped. */
  route: string;
};

type BannerState = {
  banner: InAppBanner | null;
  /** Conversation currently open + focused; its messages get no banner. */
  activeConversationId: string | null;
  show: (banner: InAppBanner) => void;
  dismiss: () => void;
  setActiveConversation: (id: string | null) => void;
};

/** Single in-app banner slot (newest wins). Driven by realtime DMs/taunts. */
export const useBannerStore = create<BannerState>((set) => ({
  banner: null,
  activeConversationId: null,
  show: (banner) => set({ banner }),
  dismiss: () => set({ banner: null }),
  setActiveConversation: (id) => set({ activeConversationId: id })
}));

export const showBanner = (banner: InAppBanner) => useBannerStore.getState().show(banner);
