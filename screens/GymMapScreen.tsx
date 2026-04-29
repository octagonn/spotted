import { LocateFixed, Search } from "lucide-react-native";
import { View } from "react-native";

import { AvatarPin } from "@/components/AvatarPin";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useGymPresence } from "@/hooks/queries/useGymPresence";
import { colors } from "@/theme/colors";

export default function GymMapScreen() {
  const presence = useGymPresence();
  const data = presence.data;
  const activeGym = data?.gyms[0];

  return (
    <View className="flex-1 bg-black px-4 pb-28 pt-16">
      <View className="mb-5 flex-row items-center gap-3 border border-iron bg-ink px-4 py-3">
        <Search color={colors.fog} size={18} />
        <Text variant="caption" className="flex-1 text-silver">
          Search gyms
        </Text>
      </View>

      <View className="relative flex-1 overflow-hidden border border-iron bg-ink">
        <View className="absolute left-0 right-0 top-16 h-px bg-iron" />
        <View className="absolute left-0 right-0 top-40 h-px bg-iron" />
        <View className="absolute bottom-28 left-0 right-0 h-px bg-iron" />
        <View className="absolute bottom-0 top-0 left-12 w-px bg-iron" />
        <View className="absolute bottom-0 top-0 right-20 w-px bg-iron" />
        <View className="absolute bottom-0 left-0 right-0 h-24 border-t border-iron bg-black px-4 py-4">
          <Text variant="micro" className="text-fog">
            LIVE PRESENCE
          </Text>
          <Text variant="display-sm" className="mt-1 text-white">
            {activeGym?.name ?? "NO GYMS SEEDED"}
          </Text>
        </View>

        <View className="absolute left-8 top-8 border border-iron bg-black px-3 py-2">
          <Text variant="micro" className="text-white">
            {activeGym?.name ?? "HOME GYM"}
          </Text>
          <Text variant="micro">{data?.presence.length ?? 0} FRIENDS HERE</Text>
        </View>

        <View className="absolute right-8 top-24">
          <AvatarPin
            uri={data?.presence[0]?.profile.avatar_url}
            name={data?.presence[0]?.profile.display_name ?? "Mia"}
          />
        </View>
        <View className="absolute left-16 top-52">
          <AvatarPin
            uri={data?.presence[1]?.profile.avatar_url}
            name={data?.presence[1]?.profile.display_name ?? "Jay"}
          />
        </View>
      </View>

      <View className="mt-4">
        <Button icon={<LocateFixed color={colors.black} size={18} />}>I'm here</Button>
      </View>
    </View>
  );
}
