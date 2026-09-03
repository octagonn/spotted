import { Image } from "expo-image";
import { View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import type { CommunityPost } from "@/hooks/queries/useCommunities";
import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

/** 3-up media grid of a community's posts, each tagged with its author. */
export function CommunityFeedGrid({
  posts,
  loading,
  emptyBody,
  onOpenAuthor
}: {
  posts: CommunityPost[];
  loading: boolean;
  emptyBody: string;
  onOpenAuthor: (post: CommunityPost) => void;
}) {
  if (posts.length === 0) {
    return loading ? (
      <SkeletonGrid count={6} />
    ) : (
      <Text variant="meta" className="px-8 pt-8 text-center">
        {emptyBody}
      </Text>
    );
  }
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2, paddingTop: 2 }}>
      {posts.map((post) => (
        <Pressable
          key={post.id}
          onPress={() => onOpenAuthor(post)}
          haptic="none"
          accessibilityLabel={`Community post by @${post.username}`}
          style={{ width: "33%" }}
        >
          <View style={{ aspectRatio: 3 / 4, backgroundColor: colors.graphite }}>
            {post.media_url ? <Image source={{ uri: post.media_url }} contentFit="cover" style={{ flex: 1 }} /> : null}
            <View
              style={{
                position: "absolute",
                left: space[1] + 2,
                bottom: space[1] + 2,
                borderRadius: radius.sm / 2,
                backgroundColor: tokens.bg.scrim,
                paddingVertical: 3,
                paddingHorizontal: 7
              }}
            >
              <Text variant="micro" className="text-white">{`@${post.username}`}</Text>
            </View>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
