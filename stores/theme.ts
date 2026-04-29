import { create } from "zustand";

type ThemeStore = {
  grainEnabled: boolean;
  reduceMotion: boolean;
  setGrainEnabled: (grainEnabled: boolean) => void;
  setReduceMotion: (reduceMotion: boolean) => void;
};

export const useThemeStore = create<ThemeStore>((set) => ({
  grainEnabled: true,
  reduceMotion: false,
  setGrainEnabled: (grainEnabled) => set({ grainEnabled }),
  setReduceMotion: (reduceMotion) => set({ reduceMotion })
}));
