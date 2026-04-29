import { Image } from "expo-image";
import { View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Text } from "@/components/ui/Text";
import { Pressable } from "@/components/ui/Pressable";
import { GymBadge } from "@/components/GymBadge";
import { ReactionBar } from "@/components/ReactionBar";
import type { FeedPost } from "@/types/domain";

type PumpCardProps = {
  post: FeedPost;
  onView?: () => void;
  onViewers?: () => void;
};

export function PumpCard({ post, onView, onViewers }: PumpCardProps) {
  return (
    <Pressable className="mb-8 border border-iron bg-ink" onLongPress={onViewers} onPress={onView}>
      <View className="relative aspect-[4/5] overflow-hidden bg-graphite">
        <Image source={{ uri: post.media_url }} contentFit="cover" className="h-full w-full" />
        <View className="absolute left-0 right-0 top-0 flex-row items-center gap-3 bg-black/60 p-4">
          <Avatar uri={post.profile.avatar_url} size="sm" />
          <View className="flex-1">
            <Text variant="caption" className="font-sansMedium text-bone">
              {post.profile.username}
            </Text>
            <GymBadge gymName={post.gym?.name} verified={post.is_verified_at_gym} />
          </View>
          <Text variant="micro" className="text-mist">
            {post.viewer_count} VIEWERS
          </Text>
        </View>
        <View className="absolute bottom-0 left-0 right-0 bg-black/70 p-4">
          <Text variant="body-strong">{post.caption ?? "No caption. Just work."}</Text>
        </View>
      </View>
      <ReactionBar />
    </Pressable>
  );
}
