import { create } from "zustand";

type CameraState = {
  captureSignal: number;
  triggerCapture: () => void;
};

export const useCameraStore = create<CameraState>((set) => ({
  captureSignal: 0,
  triggerCapture: () => set((state) => ({ captureSignal: state.captureSignal + 1 }))
}));
