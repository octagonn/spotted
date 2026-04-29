import { Camera, useCameraDevice, useCameraPermission, useMicrophonePermission } from "react-native-vision-camera";

export function useSpottedCamera(position: "front" | "back") {
  const device = useCameraDevice(position);
  const cameraPermission = useCameraPermission();
  const microphonePermission = useMicrophonePermission();
  return {
    Camera,
    device,
    cameraPermission,
    microphonePermission,
    ready: Boolean(device && cameraPermission.hasPermission && microphonePermission.hasPermission)
  };
}
