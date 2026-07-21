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
      <View className="rounded-full border-[1.5px] border-white bg-black p-[2px]">
        <Avatar uri={uri} size="sm" rounded="circle" />
      </View>
      <View className="mt-1 rounded-pill border border-hairline-strong bg-black/80 px-3 py-1">
        <Text variant="micro" className="text-white">
          {name}
        </Text>
      </View>
    </View>
  );
}
