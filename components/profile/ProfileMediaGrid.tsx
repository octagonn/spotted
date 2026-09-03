import type { LucideIcon } from "lucide-react-native";
import { useWindowDimensions, View } from "react-native";

import { PostGridCell } from "@/components/profile/PostGridCell";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pressable } from "@/components/ui/Pressable";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { icon, tokens } from "@/theme/tokens";

export type GridPost = {
  id: string;
  mediaUrl: string | null;
  thumbnailUrl?: string | null;
  insetUrl?: string | null;
  isVideo: boolean;
};

type ProfileMediaGridProps = {
  posts: GridPost[];
  isLoading: boolean;
  onPressPost: (postId: string) => void;
  empty: { icon: LucideIcon; title: string; body?: string };
  skeletonCount?: number;
};

/**
 * Three-column 4:5 media grid with its loading and empty states. Cell width
 * is an exact third of the window so it is ALWAYS three columns.
 */
export function ProfileMediaGrid({ posts, isLoading, onPressPost, empty, skeletonCount = 9 }: ProfileMediaGridProps) {
  const { width } = useWindowDimensions();
  const cellW = Math.floor(width / 3);
  const EmptyIcon = empty.icon;

  if (posts.length > 0) {
    return (
      <View style={{ flexDirection: "row", flexWrap: "wrap", paddingTop: 2 }}>
        {posts.map((post) => (
          <Pressable
            key={post.id}
            haptic="none"
            style={{ width: cellW, aspectRatio: 4 / 5, padding: 1 }}
            accessibilityLabel="Open post"
            onPress={() => onPressPost(post.id)}
          >
            <PostGridCell
              mediaUrl={post.mediaUrl}
              thumbnailUrl={post.thumbnailUrl}
              insetUrl={post.insetUrl}
              isVideo={post.isVideo}
            />
          </Pressable>
        ))}
      </View>
    );
  }
  if (isLoading) {
    return (
      <View style={{ paddingTop: 2 }}>
        <SkeletonGrid count={skeletonCount} />
      </View>
    );
  }
  return (
    <EmptyState
      icon={<EmptyIcon size={icon.size.md} color={tokens.text.tertiary} strokeWidth={icon.stroke.thin} />}
      title={empty.title}
      body={empty.body}
      center
    />
  );
}
