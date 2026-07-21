import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { PostCard } from "@/components/post/PostCard";
import { ReactionCaptureSheet } from "@/components/post/ReactionCaptureSheet";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { useSheet } from "@/components/ui/Sheet";
import { useMyProfile, useProfileById } from "@/hooks/queries/useProfile";
import { useSignedUserPosts, type SignedPost } from "@/hooks/queries/useSignedUserPosts";
import { type FeedMockPost } from "@/lib/redesignData";
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
    const withMedia = (posts.data ?? []).filter((p) => p.media_url);
    return tab === "progress" ? withMedia.filter((p) => p.permanent) : withMedia;
  }, [posts.data, tab]);

  const feedPosts: FeedMockPost[] = useMemo(
    () =>
      list.map((post: SignedPost) => ({
        id: post.id,
        kind: "fb",
        user: { name, handle, avatarUrl },
        time: relTime(post.created_at),
        mediaUri: post.media_url ?? undefined,
        caption: post.caption ?? undefined,
        reactions: [],
        comments: []
      })),
    [list, name, handle, avatarUrl]
  );

  const initialIndex = Math.max(
    0,
    feedPosts.findIndex((p) => p.id === postId)
  );

  const openReactionCapture = (id: string) => {
    sheet.open(<ReactionCaptureSheet postId={id} onClose={sheet.close} />);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Posts" sub={`@${handle}`} />
      <FlashList
        data={feedPosts}
        keyExtractor={(item: FeedMockPost) => item.id}
        initialScrollIndex={initialIndex}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
        renderItem={({ item }: { item: FeedMockPost }) => (
          <PostCard post={item} locked={false} onReact={openReactionCapture} />
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
