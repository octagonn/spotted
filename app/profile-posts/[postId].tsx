import { useIsFocused } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { router, useLocalSearchParams, type Href } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";

import { PostCard } from "@/components/post/PostCard";
import { ReactionCaptureSheet } from "@/components/post/ReactionCaptureSheet";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { useSheet } from "@/components/ui/Sheet";
import { useMyProfile, useProfileById } from "@/hooks/queries/useProfile";
import { useSignedUserPosts, type SignedPost } from "@/hooks/queries/useSignedUserPosts";
import { type FeedMockPost } from "@/lib/redesignData";
import { localDateKey } from "@/stores/ui";
import { colors } from "@/theme/colors";

/** Relative "3h"/"2d" stamp — matches the home feed's formatting. */
function relTime(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (60 * 24))}d`;
}

/**
 * Instagram-style post view: tapping a grid tile opens the user's posts as one
 * vertical, scrollable feed, landing on the tapped post. Reuses the home feed's
 * PostCard + reaction sheet so scrolling and styling stay uniform.
 */
export default function ProfilePostsScreen() {
  const { postId, tab, user } = useLocalSearchParams<{ postId: string; tab?: string; user?: string }>();
  const sheet = useSheet();
  const myProfile = useMyProfile();
  // `user` (a profile id) opens another person's posts; otherwise, your own.
  const otherProfile = useProfileById(user);
  const ownerId = user ?? myProfile.data?.id;
  const owner = user ? otherProfile.data : myProfile.data;
  const posts = useSignedUserPosts(ownerId);

  const name = owner?.display_name ?? "You";
  const handle = owner?.username ?? "you";
  const avatarUrl = owner?.avatar_url ?? null;

  // Same set the grid showed: all posts, or permanent-only on the progress tab.
  const list = useMemo(() => {
    const withMedia = (posts.data ?? []).filter((p) => p.hasMedia);
    return tab === "progress" ? withMedia.filter((p) => p.permanent) : withMedia;
  }, [posts.data, tab]);

  const feedPosts: FeedMockPost[] = useMemo(
    () =>
      list.map((post: SignedPost) => ({
        id: post.id,
        user: { name, handle, avatarUrl },
        time: relTime(post.created_at),
        kind: post.mediaType === "video" ? "video" : "fb",
        mediaUri: post.mediaType === "video" ? undefined : post.media_url ?? undefined,
        video: post.mediaType === "video" && post.media_url ? { uri: post.media_url, trimStart: 0, trimEnd: 0 } : undefined,
        insetUri: post.inset_url ?? undefined,
        // Everything from that day: extra photos + attached workout slides.
        mediaUris: post.media_urls?.length ? post.media_urls : undefined,
        workouts: post.workouts.length ? post.workouts : undefined,
        caption: post.caption ?? undefined,
        music: post.music
          ? { title: post.music.title, artist: post.music.artist, artworkUrl: post.music.artworkUrl, previewUrl: post.music.previewUrl, clipStart: post.music.clipStart }
          : undefined,
        reactions: [],
        comments: []
      })),
    [list, name, handle, avatarUrl]
  );

  const initialIndex = Math.max(
    0,
    feedPosts.findIndex((p) => p.id === postId)
  );

  const isFocused = useIsFocused();
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { isViewable: boolean; item?: FeedMockPost }[] }) => {
      const first = viewableItems.find((v) => v.isViewable && v.item);
      setActivePostId(first?.item?.id ?? null);
    }
  ).current;

  const openReactionCapture = (id: string) => {
    sheet.open(<ReactionCaptureSheet postId={id} onClose={sheet.close} />);
  };

  // Day-group context (1a): jump from this single-post scroll to the full day
  // the tapped post belongs to.
  const tapped = list.find((p) => p.id === postId);
  const openFullDay = () => {
    if (!tapped || !ownerId) return;
    const key = localDateKey(new Date(tapped.created_at));
    router.push(`/daily/${key}?user=${ownerId}&post=${tapped.id}` as Href);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader
        title="Posts"
        sub={`@${handle}`}
        right={
          tapped ? (
            <Text onPress={openFullDay} accessibilityRole="button" style={{ fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.silver }}>
              See full day
            </Text>
          ) : undefined
        }
      />
      <FlashList
        data={feedPosts}
        keyExtractor={(item: FeedMockPost) => item.id}
        initialScrollIndex={initialIndex}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }: { item: FeedMockPost }) => (
          <PostCard post={item} locked={false} audible={isFocused && item.id === activePostId} onReact={openReactionCapture} />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40 }}>
            <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center", lineHeight: 19 }}>
              {posts.isLoading ? "Loading…" : "No posts yet."}
            </Text>
          </View>
        }
      />
    </View>
  );
}
