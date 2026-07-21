import { Image } from "expo-image";
import { Bookmark, Heart, MessageCircle, MoreHorizontal, Repeat2, Send } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useMyReactions, useReplayPost, useToggleLike, useToggleSaved } from "@/hooks/queries/usePostReactions";
import { selectionHaptic } from "@/lib/haptics";
import { hoursLeft, timeAgo } from "@/lib/time";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import type { FeedPost } from "@/types/domain";

type FeedPostCardProps = {
  post: FeedPost;
  onView?: () => void;
  onOpenViewers?: () => void;
  onOpenProfile?: () => void;
  onOpenChat?: () => void;
};

export function FeedPostCard({ post, onView, onOpenViewers, onOpenProfile, onOpenChat }: FeedPostCardProps) {
  const userId = useAuthStore((state) => state.userId);
  const isOwnPost = Boolean(userId) && post.user_id === userId;

  const myReactions = useMyReactions();
  const toggleLike = useToggleLike();
  const toggleSaved = useToggleSaved();
  const replayPost = useReplayPost();

  const liked = (myReactions.data ?? []).includes(post.id);
  // Only the post owner can persist posts.saved (RLS); keep save local for friends' posts.
  const [localSaved, setLocalSaved] = useState(false);
  const saved = isOwnPost ? post.saved : localSaved;
  const [expanded, setExpanded] = useState(false);

  const ago = timeAgo(post.created_at);
  const hours = hoursLeft(post.expires_at);

  return (
    <View className="mb-2">
      <View className="flex-row items-center gap-3 px-4 pb-3 pt-1">
        <Pressable onPress={onOpenProfile} pressedClassName="opacity-80" haptic={false}>
          <Avatar uri={post.profile.avatar_url} size="sm" rounded="circle" />
        </Pressable>
        <Pressable className="flex-1" onPress={onOpenProfile} pressedClassName="opacity-80" haptic={false}>
          <Text variant="body-strong" className="text-white">
            {post.profile.display_name}
          </Text>
          <Text variant="micro" className="text-mist">
            {post.gym?.name ? `${post.gym.name.toUpperCase()} · ${ago}` : ago}
          </Text>
        </Pressable>
        <Pressable className="h-8 w-8 items-center justify-center" haptic={false}>
          <MoreHorizontal color={colors.silver} size={18} strokeWidth={1.8} />
        </Pressable>
      </View>

      <Pressable
        className="mx-3 overflow-hidden rounded-card border border-hairline"
        onPress={onView}
        pressedClassName="opacity-95"
        haptic={false}
      >
        <View className="aspect-[4/5] bg-graphite">
          <Image source={{ uri: post.media_url }} contentFit="cover" style={{ flex: 1 }} />
          {hours > 0 ? (
            <View className="absolute right-3 top-3 overflow-hidden rounded-pill border border-hairline-strong bg-black/55 px-2.5 py-1">
              <Text variant="micro" className="text-white">
                {hours}H LEFT
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <View className="flex-row items-center justify-between px-4 pt-3">
        <View className="flex-row items-center gap-4">
          <Pressable
            className="h-9 w-9 items-center justify-center"
            haptic={false}
            onPress={async () => {
              toggleLike.mutate({ postId: post.id, liked: !liked });
              await selectionHaptic();
            }}
          >
            <Heart
              color={liked ? "#FF2D55" : colors.white}
              fill={liked ? "#FF2D55" : "transparent"}
              size={24}
              strokeWidth={1.8}
            />
          </Pressable>
          <Pressable className="h-9 w-9 items-center justify-center" haptic={false} onPress={onOpenChat}>
            <MessageCircle color={colors.white} size={24} strokeWidth={1.8} />
          </Pressable>
          <Pressable className="h-9 w-9 items-center justify-center" haptic={false}>
            <Send color={colors.white} size={22} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            className="h-9 w-9 items-center justify-center"
            haptic={false}
            onPress={() => {
              replayPost.mutate(post.id);
              onView?.();
            }}
          >
            <Repeat2 color={colors.silver} size={22} strokeWidth={1.8} />
          </Pressable>
        </View>
        <Pressable
          className="h-9 w-9 items-center justify-center"
          haptic={false}
          onPress={async () => {
            if (isOwnPost) {
              toggleSaved.mutate({ postId: post.id, saved: !saved });
            } else {
              setLocalSaved((current) => !current);
            }
            await selectionHaptic();
          }}
        >
          <Bookmark
            color={saved ? colors.white : colors.silver}
            fill={saved ? colors.white : "transparent"}
            size={22}
            strokeWidth={1.8}
          />
        </Pressable>
      </View>

      {post.caption ? (
        <View className="px-4 pt-2">
          <Text variant="body" numberOfLines={expanded ? undefined : 2} className="text-bone">
            <Text className="font-sansStrong text-white">{post.profile.username} </Text>
            {post.caption}
          </Text>
          {!expanded && post.caption.length > 90 ? (
            <Pressable onPress={() => setExpanded(true)} haptic={false}>
              <Text variant="caption" className="mt-1 text-mist">
                more
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {post.viewer_count > 0 ? (
        <Pressable className="px-4 pt-2" onPress={onOpenViewers} haptic={false}>
          <Text variant="micro" className="text-mist">
            VIEWED BY {post.viewer_count}
          </Text>
        </Pressable>
      ) : null}

      {post.music_title ? (
        <View className="px-4 pt-2">
          <Text variant="micro" className="text-fog">
            {post.music_title} / {post.music_artist}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
