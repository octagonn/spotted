import { Camera as CameraIcon, Music2, RefreshCcw, Send, Zap } from "lucide-react-native";
import { useRef, useState } from "react";
import { TextInput, View } from "react-native";
import { Camera } from "react-native-vision-camera";

import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useSpottedCamera } from "@/lib/camera";
import { impactHaptic, successHaptic } from "@/lib/haptics";
import { mockGyms } from "@/lib/mockData";
import { colors } from "@/theme/colors";

export default function CameraScreen() {
  const [position, setPosition] = useState<"front" | "back">("back");
  const [captured, setCaptured] = useState(false);
  const [caption, setCaption] = useState("");
  const cameraRef = useRef<Camera>(null);
  const camera = useSpottedCamera(position);

  async function capture() {
    setCaptured(true);
    await impactHaptic();
    if (camera.ready && cameraRef.current) {
      await cameraRef.current.takePhoto();
    }
    await successHaptic();
  }

  if (!camera.ready || !camera.device) {
    return (
      <View className="flex-1 justify-end bg-black p-6 pb-32">
        <Text variant="display-md">CHECK IN</Text>
        <Text variant="italic" className="mt-5">
          Permission first. Gym drops after.
        </Text>
        <Button
          className="mt-8"
          onPress={async () => {
            await camera.cameraPermission.requestPermission();
            await camera.microphonePermission.requestPermission();
          }}
        >
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
        <View className="items-center">
          <Text variant="micro" className="text-mist">
            CHECK IN
          </Text>
          <Text variant="caption" className="text-white">
            Today's gym drop
          </Text>
        </View>
        <Pressable
          className="h-12 w-12 items-center justify-center border border-iron bg-black/70"
          onPress={() => setPosition(position === "back" ? "front" : "back")}
        >
          <RefreshCcw color={colors.white} size={22} />
        </Pressable>
      </View>
      <View className="absolute bottom-32 left-5 right-5 items-center">
        {captured ? (
          <View className="mb-8 w-full border border-iron bg-black/80 p-4">
            <Text variant="micro" className="text-white">
              VERIFIED AT {mockGyms[0].name.toUpperCase()}
            </Text>
            <TextInput
              className="mt-4 min-h-12 border border-iron bg-ink px-3 py-2 font-sans text-[17px] text-white"
              placeholder="Caption the damage"
              placeholderTextColor={colors.fog}
              value={caption}
              onChangeText={setCaption}
            />
            <View className="mt-3 flex-row items-center gap-2 border border-iron bg-ink px-3 py-3">
              <Music2 color={colors.white} size={16} />
              <Text variant="caption" className="flex-1">
                Add song
              </Text>
              <Text variant="micro">OPTIONAL</Text>
            </View>
            <Button className="mt-4" icon={<Send color={colors.black} size={17} />}>
              Post 24h drop
            </Button>
          </View>
        ) : null}
        <Pressable
          className="h-24 w-24 items-center justify-center border border-white bg-white"
          pressedClassName="scale-95"
          onPress={capture}
          testID="camera-shutter"
          accessibilityRole="button"
          accessibilityLabel="Capture drop"
        >
          <CameraIcon color={colors.black} size={34} strokeWidth={2.4} />
        </Pressable>
        <Text variant="micro" className="mt-4 text-mist">
          TAP PHOTO / HOLD VIDEO
        </Text>
      </View>
    </View>
  );
}
