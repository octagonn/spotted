import { router, useLocalSearchParams, type Href } from "expo-router";
import { useMemo } from "react";
import { Text, View } from "react-native";

import { PostPagerScreen } from "@/components/post/PostPagerScreen";
import { useMyProfile, useProfileById } from "@/hooks/queries/useProfile";
import { useSignedUserPosts, type SignedPost } from "@/hooks/queries/useSignedUserPosts";
import { type FeedMockPost } from "@/lib/redesignData";
import { signedPostToFeedPost } from "@/lib/toFeedPost";
import { localDateKey } from "@/stores/ui";
import { colors } from "@/theme/colors";

/**
 * Instagram-style post view: tapping a grid tile opens the user's posts as one
 * vertical, scrollable feed, landing on the tapped post. Reuses the home feed's
 * PostCard + reaction sheet so scrolling and styling stay uniform.
 */
export default function ProfilePostsScreen() {
  const { postId, tab, user } = useLocalSearchParams<{ postId: string; tab?: string; user?: string }>();
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
    () => list.map((post: SignedPost) => signedPostToFeedPost(post, { name, handle, avatarUrl })),
    [list, name, handle, avatarUrl]
  );

  // Day-group context (1a): jump from this single-post scroll to the full day
  // the tapped post belongs to.
  const tapped = list.find((p) => p.id === postId);
  const openFullDay = () => {
    if (!tapped || !ownerId) return;
    const key = localDateKey(new Date(tapped.created_at));
    router.push(`/daily/${key}?user=${ownerId}&post=${tapped.id}` as Href);
  };

  return (
    <PostPagerScreen
      title="Posts"
      sub={`@${handle}`}
      headerRight={
        tapped ? (
          <Text onPress={openFullDay} accessibilityRole="button" style={{ fontFamily: "Geist_600SemiBold", fontSize: 12, color: colors.silver }}>
            See full day
          </Text>
        ) : undefined
      }
      posts={feedPosts}
      initialPostId={postId}
      isLoading={posts.isLoading}
      empty={
        <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40 }}>
          <Text style={{ fontSize: 13, color: colors.fog, textAlign: "center", lineHeight: 19 }}>
            No posts yet.
          </Text>
        </View>
      }
    />
  );
}
