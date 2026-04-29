import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Camera, Eye, MessageCircle, Repeat2 } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { PumpCard } from "@/components/PumpCard";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { Skeleton } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useFeed, useMarkPostViewed } from "@/hooks/queries/useFeed";
import { useStreak } from "@/hooks/queries/useStreak";
import { mockDailyPrompt, mockSkipSignals } from "@/lib/mockData";
import { colors } from "@/theme/colors";

const storySignals = [
  { label: "views", value: "23", icon: Eye },
  { label: "replays", value: "6", icon: Repeat2 },
  { label: "replies", value: "4", icon: MessageCircle }
] as const;

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const feed = useFeed();
  const streak = useStreak();
  const markViewed = useMarkPostViewed();
  const posts = feed.data ?? [];

  return (
    <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-end justify-between border-b border-iron px-4 pb-4 pt-4">
        <View className="max-w-[70%]">
          <Text variant="display-sm">TODAY</Text>
          <Text variant="display-md" className="mt-4">
            14:37:52
          </Text>
          <Text variant="micro" className="mt-2">
            LEFT TO DROP YOURS
          </Text>
        </View>
        <Pressable
          className="min-w-20 items-center border border-iron bg-ink px-3 py-2"
          onPress={() => router.push("/streak")}
        >
          <Text variant="micro">STREAK</Text>
          <Text variant="body-strong">{streak.data?.current_streak ?? 0}</Text>
        </Pressable>
      </View>

      <FlashList
        data={posts}
        estimatedItemSize={620}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        ListHeaderComponent={
          <View>
            <View className="border border-iron bg-ink p-5">
              <View className="flex-row items-start justify-between gap-4">
                <View className="flex-1">
                  <Text variant="micro" className="text-mist">
                    DAILY GYM DROP
                  </Text>
                  <Text variant="body-strong" className="mt-3">
                    {mockDailyPrompt.title}
                  </Text>
                  <Text variant="caption" className="mt-2">
                    {mockDailyPrompt.body}
                  </Text>
                </View>
                <View className="h-12 w-12 items-center justify-center border border-white bg-white">
                  <Camera color={colors.black} size={20} strokeWidth={2.2} />
                </View>
              </View>
              <Button className="mt-5" onPress={() => router.push("/camera")}>
                Post today's drop
              </Button>
            </View>

            <View className="my-6 border-y border-iron py-4">
              <View className="mb-4 flex-row items-center justify-between">
                <Text variant="micro" className="text-white">
                  FRIEND DROPS
                </Text>
                <Text variant="micro">24H / {posts.length} LIVE</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="h-40">
                {posts.map((item) => (
                  <Pressable
                    key={item.id}
                    className="mr-3 w-28"
                    onPress={() => markViewed.mutate(item.id)}
                    onLongPress={() => router.push(`/post/${item.id}`)}
                  >
                    <View className="aspect-[3/4] overflow-hidden border border-iron bg-graphite">
                      <Image source={{ uri: item.media_url }} contentFit="cover" className="h-full w-full" />
                      <View className="absolute left-0 right-0 top-0 bg-black/60 p-2">
                        <Text variant="micro" className="text-white">
                          {item.profile.username}
                        </Text>
                        <Text variant="micro">18H</Text>
                      </View>
                      <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between bg-black/70 p-2">
                        <View className="flex-row items-center gap-1">
                          <Eye color={colors.mist} size={12} />
                          <Text variant="micro" className="text-mist">
                            {item.viewer_count}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-1">
                          <Repeat2 color={colors.mist} size={12} />
                          <Text variant="micro" className="text-mist">
                            {item.replay_count}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View className="mb-6 border border-iron bg-graphite p-4">
              <Text variant="micro" className="text-mist">
                SKIP WATCH
              </Text>
              <Text variant="body-strong" className="mt-2">
                {mockSkipSignals[0].body}
              </Text>
            </View>

            <View className="mb-6 flex-row gap-3">
              {storySignals.map((signal) => {
                const Icon = signal.icon;
                return (
                  <View key={signal.label} className="flex-1 border border-iron bg-ink p-3">
                    <Icon color={colors.mist} size={17} strokeWidth={1.8} />
                    <Text variant="display-sm" className="mt-3">
                      {signal.value}
                    </Text>
                    <Text variant="micro">{signal.label}</Text>
                  </View>
                );
              })}
            </View>

            {feed.isLoading ? (
              <View className="pb-6">
                <Skeleton word="DROPS" />
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          feed.isLoading ? null : (
            <EmptyState
              title="NO ACTIVE DROPS."
              body="Your friends are slacking. Or you have no friends yet. Either way, fix it."
              action="Open camera"
              onAction={() => router.push("/camera")}
            />
          )
        }
        renderItem={({ item }) => (
          <PumpCard
            post={item}
            onView={() => markViewed.mutate(item.id)}
            onViewers={() => router.push(`/post/${item.id}`)}
          />
        )}
      />
    </View>
  );
}
