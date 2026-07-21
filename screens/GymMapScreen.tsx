import { LocateFixed, Search, UserPlus } from "lucide-react-native";
import { View } from "react-native";

import { AvatarPin } from "@/components/AvatarPin";
import { Screen } from "@/components/Screen";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useFriendSuggestions } from "@/hooks/queries/useFriends";
import { useGymPresence } from "@/hooks/queries/useGymPresence";
import { mockGyms, mockRoutine } from "@/lib/mockData";
import { colors } from "@/theme/colors";

export default function GymMapScreen() {
  const presence = useGymPresence();
  const suggestions = useFriendSuggestions();
  const data = presence.data;
  const activeGym = data?.gyms[0] ?? mockGyms[0];
  const suggestionList = suggestions.data ?? [];

  return (
    <Screen>
      <Text variant="display-sm">MY GYM</Text>
      <Text variant="caption" className="mt-2 italic">
        The people you might actually run into.
      </Text>

      <View className="mt-8 flex-row items-center gap-3 border border-hairline-strong bg-ink px-4 py-3">
        <Search color={colors.fog} size={18} />
        <Text variant="caption" className="flex-1 text-silver">
          Search usernames or gyms
        </Text>
      </View>

      <View className="mt-6 border border-hairline-strong bg-ink p-5">
        <Text variant="micro" className="text-mist">
          MAIN GYM
        </Text>
        <Text variant="display-md" className="mt-3">
          {activeGym.name.toUpperCase()}
        </Text>
        <Text variant="caption" className="mt-3">
          Usually 5:00 PM. Arnold split. Discoverable at this gym.
        </Text>
        <View className="mt-6 flex-row border-t border-hairline-strong pt-4">
          <View className="flex-1">
            <Text variant="display-sm">{data?.presence.length ?? 0}</Text>
            <Text variant="micro">FRIENDS HERE</Text>
          </View>
          <View className="flex-1">
            <Text variant="display-sm">{suggestionList.length}</Text>
            <Text variant="micro">NEW FACES</Text>
          </View>
        </View>
      </View>

      <View className="mt-6 overflow-hidden border border-hairline-strong bg-ink">
        <View className="relative h-80">
          <View className="absolute left-0 right-0 top-16 h-px bg-iron" />
          <View className="absolute left-0 right-0 top-40 h-px bg-iron" />
          <View className="absolute bottom-20 left-0 right-0 h-px bg-iron" />
          <View className="absolute bottom-0 left-12 top-0 w-px bg-iron" />
          <View className="absolute bottom-0 right-20 top-0 w-px bg-iron" />
          <View className="absolute left-6 top-6 border border-hairline-strong bg-black px-3 py-2">
            <Text variant="micro" className="text-white">
              GYM FLOOR
            </Text>
            <Text variant="micro">ONLY GYM-LEVEL PRESENCE</Text>
          </View>
          <View className="absolute right-8 top-24">
            <AvatarPin
              uri={data?.presence[0]?.profile.avatar_url}
              name={data?.presence[0]?.profile.display_name ?? "Mia"}
            />
          </View>
          <View className="absolute left-16 top-48">
            <AvatarPin
              uri={data?.presence[1]?.profile.avatar_url}
              name={data?.presence[1]?.profile.display_name ?? "Dre"}
            />
          </View>
        </View>
        <View className="border-t border-hairline-strong p-4">
          <Button icon={<LocateFixed color={colors.black} size={18} />}>I'm here</Button>
        </View>
      </View>

      {suggestionList.length > 0 ? (
        <View className="mt-8">
          <Text variant="micro" className="text-white">
            AT YOUR GYM
          </Text>
          <View className="mt-3 gap-3">
            {suggestionList.map((suggestion) => (
              <Pressable key={suggestion.id} className="flex-row items-center gap-3 border border-hairline-strong bg-ink p-3">
                <Avatar uri={suggestion.avatar_url} />
                <View className="flex-1">
                  <Text variant="body-strong">{suggestion.display_name}</Text>
                  <Text variant="micro">@{suggestion.username}</Text>
                </View>
                <View className="h-10 w-10 items-center justify-center border border-hairline-strong bg-white">
                  <UserPlus color={colors.black} size={17} />
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View className="mt-8 border border-hairline-strong bg-ink p-5">
        <Text variant="micro" className="text-white">
          ROUTINES PEOPLE CAN STEAL
        </Text>
        <View className="mt-4 gap-3">
          {mockRoutine.slice(0, 4).map((item) => (
            <View key={item.day} className="flex-row items-center border-t border-hairline-strong pt-3">
              <Text variant="micro" className="w-14 text-white">
                {item.day}
              </Text>
              <Text variant="body" className="flex-1">
                {item.muscle}
              </Text>
              <Text variant="micro">{item.time}</Text>
            </View>
          ))}
        </View>
      </View>
    </Screen>
  );
}
