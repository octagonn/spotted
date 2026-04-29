import { Camera as CameraIcon, RefreshCcw, Zap } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { impactHaptic, successHaptic } from "@/lib/haptics";
import { colors } from "@/theme/colors";

export default function CameraScreen() {
  const [captured, setCaptured] = useState(false);
  const [front, setFront] = useState(false);

  async function capture() {
    await impactHaptic();
    setCaptured(true);
    await successHaptic();
  }

  return (
    <View className="flex-1 bg-black">
      <View className="flex-1 border-x border-iron bg-ink">
        <View className="absolute bottom-0 left-0 right-0 top-0 opacity-40">
          <View className="mt-24 h-px bg-iron" />
          <View className="mt-28 h-px bg-iron" />
          <View className="mt-28 h-px bg-iron" />
          <View className="absolute bottom-0 top-0 left-12 w-px bg-iron" />
          <View className="absolute bottom-0 top-0 right-12 w-px bg-iron" />
        </View>
        <View className="absolute left-0 right-0 top-14 flex-row items-center justify-between px-5">
          <Pressable className="h-12 w-12 items-center justify-center border border-iron bg-black">
            <Zap color={colors.white} size={22} />
          </Pressable>
          <Pressable
            className="h-12 w-12 items-center justify-center border border-iron bg-black"
            onPress={() => setFront((value) => !value)}
          >
            <RefreshCcw color={colors.white} size={22} />
          </Pressable>
        </View>
        <View className="absolute left-6 top-36">
          <Text variant="micro" className="text-fog">
            WEB CAMERA PREVIEW
          </Text>
          <Text variant="display-md" className="mt-3 text-white">
            {front ? "FRONT" : "BACK"}
          </Text>
        </View>
      </View>

      <View className="absolute bottom-32 left-5 right-5 items-center">
        {captured ? (
          <View className="mb-8 w-full border border-iron bg-black p-4">
            <Text variant="micro" className="text-white">
              VERIFIED AT GOLD'S GYM CHELSEA
            </Text>
            <Text variant="caption" className="mt-2">
              Caption field and Post / Send to flow are ready for the native dev client.
            </Text>
          </View>
        ) : null}
        <Pressable
          className="h-24 w-24 items-center justify-center border border-white bg-white"
          pressedClassName="scale-95"
          onPress={capture}
        >
          <CameraIcon color={colors.black} size={34} strokeWidth={2.4} />
        </Pressable>
      </View>
    </View>
  );
}
