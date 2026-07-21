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
  show: (banner: InAppBanner) => void;
  dismiss: () => void;
};

/** Single in-app banner slot (newest wins). Driven by realtime DMs/taunts. */
export const useBannerStore = create<BannerState>((set) => ({
  banner: null,
  show: (banner) => set({ banner }),
  dismiss: () => set({ banner: null })
}));

export const showBanner = (banner: InAppBanner) => useBannerStore.getState().show(banner);
