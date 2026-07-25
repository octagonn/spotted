import { create } from "zustand";

/**
 * Cross-component tab signals. The custom tab bar uses navigation.navigate(),
 * which doesn't emit the "tabPress" event React Navigation's useScrollToTop
 * relies on — so re-tapping a focused tab does nothing by default. This bumps
 * a nonce the Home feed watches to scroll back to top + refresh.
 */
type TabActionsState = {
  feedResetNonce: number;
  bumpFeedReset: () => void;
};

export const useTabActions = create<TabActionsState>((set) => ({
  feedResetNonce: 0,
  bumpFeedReset: () => set((s) => ({ feedResetNonce: s.feedResetNonce + 1 }))
}));
