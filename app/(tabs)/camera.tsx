import { useRef, useState } from "react";
import { View } from "react-native";
import { Camera as CameraIcon, RefreshCcw, Zap } from "lucide-react-native";
import { Camera } from "react-native-vision-camera";

import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useSpottedCamera } from "@/lib/camera";
import { impactHaptic, successHaptic } from "@/lib/haptics";
import { colors } from "@/theme/colors";

export default function CameraScreen() {
  const [position, setPosition] = useState<"front" | "back">("back");
  const [captured, setCaptured] = useState(false);
  const cameraRef = useRef<Camera>(null);
  const camera = useSpottedCamera(position);

  async function capture() {
    await impactHaptic();
    if (camera.ready && cameraRef.current) {
      await cameraRef.current.takePhoto();
    }
    setCaptured(true);
    await successHaptic();
  }

  if (!camera.ready || !camera.device) {
    return (
      <View className="flex-1 justify-end bg-black p-6 pb-32">
        <Text variant="display-md">CAMERA</Text>
        <Text variant="italic" className="mt-5">
          Permission first. Pump drops after.
        </Text>
        <Button className="mt-8" onPress={async () => {
          await camera.cameraPermission.requestPermission();
          await camera.microphonePermission.requestPermission();
        }}>
          Enable camera
        </Button>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      <Camera ref={cameraRef} device={camera.device} isActive photo video audio style={{ flex: 1 }} />
      <View className="absolute left-0 right-0 top-14 flex-row items-center justify-between px-5">
        <Pressable className="h-12 w-12 items-center justify-center border border-iron bg-black/70">
          <Zap color={colors.white} size={22} />
        </Pressable>
        <Pressable className="h-12 w-12 items-center justify-center border border-iron bg-black/70" onPress={() => setPosition(position === "back" ? "front" : "back")}>
          <RefreshCcw color={colors.white} size={22} />
        </Pressable>
      </View>
      <View className="absolute bottom-32 left-5 right-5 items-center">
        {captured ? (
          <View className="mb-8 w-full border border-iron bg-black/80 p-4">
            <Text variant="micro" className="text-white">
              VERIFIED AT GOLD'S GYM CHELSEA
            </Text>
            <Text variant="caption" className="mt-2">
              Caption field and Post / Send to flow are wired for Supabase Storage.
            </Text>
          </View>
        ) : null}
        <Pressable className="h-24 w-24 items-center justify-center border border-white bg-white" pressedClassName="scale-95" onPress={capture}>
          <CameraIcon color={colors.black} size={34} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}
