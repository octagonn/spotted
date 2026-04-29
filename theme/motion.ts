import { Easing } from "react-native-reanimated";

export const motion = {
  duration: {
    instant: 120,
    fast: 220,
    base: 320,
    slow: 480
  },
  easing: {
    standard: Easing.bezier(0.32, 0.08, 0.24, 1),
    emphasized: Easing.bezier(0.2, 0, 0, 1),
    exit: Easing.bezier(0.4, 0, 1, 1)
  }
} as const;
