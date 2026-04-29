import { View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Text";

type AvatarPinProps = {
  uri?: string | null;
  name: string;
};

export function AvatarPin({ uri, name }: AvatarPinProps) {
  return (
    <View className="items-center">
      <View className="border border-white bg-black p-1">
        <Avatar uri={uri} size="sm" />
      </View>
      <View className="mt-1 border border-iron bg-black px-2 py-1">
        <Text variant="micro" className="text-white">
          {name}
        </Text>
      </View>
    </View>
  );
}
