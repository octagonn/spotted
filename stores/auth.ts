import { create } from "zustand";

type AuthState = {
  userId: string | null;
  onboarded: boolean;
  setUserId: (userId: string | null) => void;
  finishOnboarding: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  userId: null,
  onboarded: false,
  setUserId: (userId) => set({ userId }),
  finishOnboarding: () => set({ onboarded: true })
}));
