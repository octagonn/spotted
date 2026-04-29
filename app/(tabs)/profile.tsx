import { Image } from "expo-image";
import { router } from "expo-router";
import { Settings } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState } from "@/components/EmptyState";
import { Screen } from "@/components/Screen";
import { StreakFlame } from "@/components/StreakFlame";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useFeed } from "@/hooks/queries/useFeed";
import { useStreak } from "@/hooks/queries/useStreak";
import { mockGyms, mockPermanentDrops, mockProfileSignals, mockProfiles, mockRoutine } from "@/lib/mockData";
import { colors } from "@/theme/colors";

export default function ProfileScreen() {
  const profile = mockProfiles[0];
  const gym = mockGyms[0];
  const streak = useStreak();
  const feed = useFeed();
  const posts = feed.data?.filter((post) => post.user_id === profile.id) ?? [];

  return (
    <Screen>
      <View className="flex-row items-start justify-between">
        <Avatar uri={profile.avatar_url} size="lg" />
        <Pressable
          className="h-12 w-12 items-center justify-center border border-iron bg-ink"
          onPress={() => router.push("/settings")}
        >
          <Settings color={colors.white} size={20} />
        </Pressable>
      </View>

      <View className="mt-8">
        <Text variant="display-sm">{profile.display_name.toUpperCase()}</Text>
        <Text variant="micro" className="mt-2">
          @{profile.username} / {gym.name} / 5:00 PM
        </Text>
        <Text variant="caption" className="mt-4 italic">
          {profile.bio ?? "No bio. Probably lifting."}
        </Text>
      </View>

      <View className="mt-8 flex-row border border-iron bg-ink">
        {mockProfileSignals.map((signal) => (
          <View key={signal.label} className="flex-1 border-r border-iron p-3 last:border-r-0">
            <Text variant="display-sm">{signal.value}</Text>
            <Text variant="micro">{signal.label}</Text>
          </View>
        ))}
      </View>

      <View className="mt-8 border border-iron bg-ink p-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text variant="micro" className="text-mist">
              ROUTINE
            </Text>
            <Text variant="title" className="mt-1">
              ARNOLD SPLIT
            </Text>
          </View>
          <StreakFlame size="sm" />
        </View>
        <View className="mt-5 gap-2">
          {mockRoutine.map((item) => (
            <View key={item.day} className="flex-row items-center border-t border-iron pt-3">
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

      <View className="mt-8 flex-row border border-iron bg-ink">
        {[
          ["STREAK", String(streak.data?.current_streak ?? 0)],
          ["LONGEST", String(streak.data?.longest_streak ?? 0)],
          ["GYM DAYS", "38"]
        ].map(([label, value]) => (
          <View key={label} className="flex-1 border-r border-iron p-4 last:border-r-0">
            <Text variant="display-sm">{value}</Text>
            <Text variant="micro">{label}</Text>
          </View>
        ))}
      </View>

      <View className="mt-8">
        <View className="flex-row items-end justify-between">
          <Text variant="title">PERMANENT DROPS</Text>
          <Text variant="micro">OPTIONAL</Text>
        </View>
        <View className="mt-4 flex-row gap-3">
          {mockPermanentDrops.map((drop) => (
            <View key={drop.id} className="flex-1 border border-iron bg-ink">
              <View className="aspect-[4/5] bg-graphite">
                <Image source={{ uri: drop.media_url }} contentFit="cover" className="h-full w-full" />
              </View>
              <View className="border-t border-iron p-3">
                <Text variant="micro" className="text-white">
                  {drop.label}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View className="mt-8">
        <Text variant="title">ACTIVE DROPS</Text>
        {posts.length === 0 ? (
          <View className="mt-4">
            <EmptyState
              title="NO ACTIVE DROPS."
              body="Get to the gym."
              action="Post"
              onAction={() => router.push("/camera")}
            />
          </View>
        ) : null}
      </View>

      <Button className="mt-8" variant="ghost" onPress={() => router.push("/settings/privacy")}>
        Privacy
      </Button>
    </Screen>
  );
}
