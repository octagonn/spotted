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
import { mockGyms, mockProfiles } from "@/lib/mockData";
import { colors } from "@/theme/colors";

const schedule = [
  ["MON", "Push"],
  ["TUE", "Pull"],
  ["WED", "Legs"],
  ["THU", "Push"],
  ["FRI", "Pull"],
  ["SAT", "Cardio"],
  ["SUN", "Rest"]
];

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
          @{profile.username} · {gym.name}
        </Text>
      </View>
      <View className="mt-8 flex-row border border-iron bg-ink">
        {[
          ["STREAK", String(streak.data?.current_streak ?? 0)],
          ["LONGEST", String(streak.data?.longest_streak ?? 0)],
          ["SCORE", String(profile.gym_score)]
        ].map(([label, value]) => (
          <View key={label} className="flex-1 border-r border-iron p-4 last:border-r-0">
            <Text variant="display-sm">{value}</Text>
            <Text variant="micro">{label}</Text>
          </View>
        ))}
      </View>
      <View className="mt-8 border border-iron bg-ink p-4">
        <View className="flex-row items-center justify-between">
          <Text variant="title">SCHEDULE</Text>
          <StreakFlame size="sm" />
        </View>
        <View className="mt-5 gap-2">
          {schedule.map(([day, muscle]) => (
            <View key={day} className="flex-row items-center border-t border-iron pt-3">
              <Text variant="micro" className="w-14 text-white">
                {day}
              </Text>
              <Text variant="body">{muscle}</Text>
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
