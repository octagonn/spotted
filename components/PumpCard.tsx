import { Eye, MessageCircle, Music2, Repeat2 } from "lucide-react-native";
import { View } from "react-native";

import { GymBadge } from "@/components/GymBadge";
import { ReactionBar } from "@/components/ReactionBar";
import { Avatar } from "@/components/ui/Avatar";
import { CachedImage } from "@/components/ui/CachedImage";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import type { FeedPost } from "@/types/domain";

type PumpCardProps = {
  post: FeedPost;
  onView?: () => void;
  onViewers?: () => void;
};

export function PumpCard({ post, onView, onViewers }: PumpCardProps) {
  return (
    <Pressable
      className="mb-6 overflow-hidden rounded-card border border-hairline-strong bg-glass-strong"
      onLongPress={onViewers}
      onPress={onView}
    >
      <View className="relative aspect-[4/5] overflow-hidden bg-graphite">
        <CachedImage source={{ uri: post.media_url }} contentFit="cover" className="h-full w-full" />
        <View className="absolute left-0 right-0 top-0 flex-row items-center gap-3 bg-black/55 p-4">
          <Avatar uri={post.profile.avatar_url} size="sm" />
          <View className="flex-1">
            <Text variant="caption" className="font-sansMedium text-bone">
              {post.profile.display_name}
            </Text>
            <GymBadge gymName={post.gym?.name} verified={post.is_verified_at_gym} />
          </View>
          <View className="items-end">
            <Text variant="micro" className="text-mist">
              18H LEFT
            </Text>
            <Text variant="micro">@{post.profile.username}</Text>
          </View>
        </View>
        <View className="absolute bottom-0 left-0 right-0 bg-black/65 p-4">
          {post.music_title ? (
            <View className="mb-3 flex-row items-center gap-2 self-start rounded-pill border border-hairline-strong bg-glass-soft px-3 py-1.5">
              <Music2 color={colors.white} size={13} />
              <Text variant="micro" className="text-white">
                {post.music_title} / {post.music_artist}
              </Text>
            </View>
          ) : null}
          <Text variant="body-strong">{post.caption ?? "No caption. Just work."}</Text>
          <View className="mt-4 flex-row gap-4">
            {[
              { label: "VIEWS", value: post.viewer_count, icon: Eye },
              { label: "REPLAYS", value: post.replay_count, icon: Repeat2 },
              { label: "REPLIES", value: post.reply_count, icon: MessageCircle }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <View key={item.label} className="flex-row items-center gap-1">
                  <Icon color={colors.mist} size={14} strokeWidth={1.8} />
                  <Text variant="micro" className="text-mist">
                    {item.value} {item.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
      <ReactionBar />
    </Pressable>
  );
}
