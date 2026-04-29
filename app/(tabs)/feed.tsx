import { FlashList } from "@shopify/flash-list";
import { router } from "expo-router";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { PumpCard } from "@/components/PumpCard";
import { StreakFlame } from "@/components/StreakFlame";
import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useFeed, useMarkPostViewed } from "@/hooks/queries/useFeed";
import { useStreak } from "@/hooks/queries/useStreak";
import { mockProfiles } from "@/lib/mockData";

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const feed = useFeed();
  const streak = useStreak();
  const markViewed = useMarkPostViewed();
  const posts = feed.data ?? [];

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-end justify-between border-b border-iron px-4 pb-4 pt-4">
        <View>
          <Text variant="display-sm">SPOTTED</Text>
          <Text variant="caption" className="mt-2 italic">
            The gym, but everyone's watching.
          </Text>
        </View>
        <Pressable className="min-w-20 items-center border border-iron bg-ink px-3 py-2" onPress={() => router.push("/streak")}>
          <Text variant="micro">YOU</Text>
          <Text variant="body-strong">{streak.data?.current_streak ?? 0}</Text>
        </Pressable>
      </View>
      <View className="border-b border-iron py-4">
        <FlashList
          horizontal
          data={mockProfiles.slice(1)}
          estimatedItemSize={72}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 16 }}
          renderItem={({ item, index }) => (
            <Pressable className="mr-5 items-center" onPress={() => router.push(`/user/${item.username}`)}>
              <View className="relative">
                <Avatar uri={item.avatar_url} size="md" />
                <View className="absolute -bottom-2 -right-2">
                  <StreakFlame size="xs" />
                </View>
              </View>
              <Text variant="micro" className="mt-3 text-mist">
                {index === 0 ? "18" : "9"}D
              </Text>
            </Pressable>
          )}
        />
      </View>
      {feed.isLoading ? (
        <View className="p-4">
          <Skeleton word="DROPS" />
        </View>
      ) : posts.length === 0 ? (
        <View className="p-4">
          <EmptyState title="NO ACTIVE DROPS." body="Your friends are slacking. Or you have no friends yet. Either way, fix it." action="Open camera" onAction={() => router.push("/camera")} />
        </View>
      ) : (
        <FlashList
          data={posts}
          estimatedItemSize={560}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          renderItem={({ item }) => (
            <PumpCard
              post={item}
              onView={() => markViewed.mutate(item.id)}
              onViewers={() => router.push(`/post/${item.id}`)}
            />
          )}
        />
      )}
    </View>
  );
}
