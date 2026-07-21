import { Music2, RefreshCcw, Send, Zap } from "lucide-react-native";
import { useState } from "react";
import { TextInput, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { impactHaptic, successHaptic } from "@/lib/haptics";
import { mockGyms } from "@/lib/mockData";
import { colors } from "@/theme/colors";

export default function CameraScreen() {
  const [captured, setCaptured] = useState(false);
  const [front, setFront] = useState(false);
  const [caption, setCaption] = useState("");

  async function capture() {
    setCaptured(true);
    await impactHaptic();
    await successHaptic();
  }

  return (
    <View className="flex-1 bg-black">
      <View className="flex-1 border-x border-hairline-strong bg-ink">
        <View className="absolute bottom-0 left-0 right-0 top-0 opacity-40">
          <View className="mt-24 h-px bg-iron" />
          <View className="mt-28 h-px bg-iron" />
          <View className="mt-28 h-px bg-iron" />
          <View className="absolute bottom-0 left-12 top-0 w-px bg-iron" />
          <View className="absolute bottom-0 right-12 top-0 w-px bg-iron" />
        </View>

        <View className="absolute left-0 right-0 top-14 flex-row items-center justify-between px-5">
          <Pressable className="h-12 w-12 items-center justify-center border border-hairline-strong bg-black">
            <Zap color={colors.white} size={22} />
          </Pressable>
          <View className="items-center">
            <Text variant="micro" className="text-mist">
              CHECK IN
            </Text>
            <Text variant="caption" className="text-white">
              Today's gym lift
            </Text>
          </View>
          <Pressable
            className="h-12 w-12 items-center justify-center border border-hairline-strong bg-black"
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
          <Text variant="caption" className="mt-3 max-w-64 italic">
            One lift. Two angles. Gone tomorrow.
          </Text>
        </View>

        <View className="absolute bottom-52 right-6 h-32 w-24 border border-hairline-strong bg-black p-2">
          <Text variant="micro" className="text-mist">
            SECOND CAM
          </Text>
          <View className="mt-auto h-12 border border-hairline-strong" />
        </View>
      </View>

      <View className="absolute bottom-32 left-5 right-5 items-center">
        {captured ? (
          <View className="mb-8 w-full border border-hairline-strong bg-black p-4">
            <Text variant="micro" className="text-white">
              VERIFIED AT {mockGyms[0].name.toUpperCase()}
            </Text>
            <TextInput
              className="mt-4 min-h-12 border border-hairline-strong bg-ink px-3 py-2 font-sans text-[17px] text-white"
              placeholder="Caption the damage"
              placeholderTextColor={colors.fog}
              value={caption}
              onChangeText={setCaption}
            />
            <View className="mt-3 flex-row items-center gap-2 border border-hairline-strong bg-ink px-3 py-3">
              <Music2 color={colors.white} size={16} />
              <Text variant="caption" className="flex-1">
                Add song
              </Text>
              <Text variant="micro">OPTIONAL</Text>
            </View>
            <Button className="mt-4" icon={<Send color={colors.black} size={17} />}>
              Post 24h lift
            </Button>
          </View>
        ) : null}
        <Pressable
          className="h-[88px] w-[88px] items-center justify-center rounded-full"
          pressedClassName="scale-95"
          onPress={capture}
          testID="camera-shutter"
          accessibilityRole="button"
          accessibilityLabel="Capture lift"
        >
          <View className="h-[88px] w-[88px] rounded-full border-[3px] border-white" />
          <View className="absolute h-[68px] w-[68px] rounded-full bg-white/95" />
        </Pressable>
        <Text variant="micro" className="mt-4 text-mist">
          TAP PHOTO / HOLD VIDEO
        </Text>
      </View>
    </View>
  );
}
