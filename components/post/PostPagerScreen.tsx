import { useIsFocused } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { useRef, useState } from "react";
import { View } from "react-native";

import { PostCard } from "@/components/post/PostCard";
import { ReactionCaptureSheet } from "@/components/post/ReactionCaptureSheet";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { useSheet } from "@/components/ui/Sheet";
import { PostCardSkeleton } from "@/components/ui/Skeleton";
import { useRecordPostViews } from "@/hooks/queries/useFeed";
import { type FeedMockPost } from "@/lib/redesignData";
import { colors } from "@/theme/colors";

/**
 * Vertical post pager: a set of posts as one scrollable feed of full
 * PostCards, landing on `initialPostId`, with viewability-driven audio and
 * the reaction-capture sheet wired up. The profile pager, day viewer, and
 * tagged pager are thin wrappers over this — only their data source, header,
 * and empty state differ.
 */
export function PostPagerScreen({
  title,
  sub,
  headerRight,
  posts,
  initialPostId,
  isLoading,
  empty
}: {
  title: string;
  sub?: string;
  headerRight?: React.ReactNode;
  posts: FeedMockPost[];
  initialPostId?: string;
  isLoading: boolean;
  /** Rendered when the list is empty and not loading. */
  empty: React.ReactNode;
}) {
  const sheet = useSheet();
  const initialIndex = Math.max(
    0,
    posts.findIndex((p) => p.id === initialPostId)
  );

  const isFocused = useIsFocused();
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  // Backend-only view capture (day viewer / profile pager / tagged pager) —
  // the server skips the viewer's own posts, so this is safe to fire for all.
  const recordPostView = useRecordPostViews();
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { isViewable: boolean; item?: FeedMockPost }[] }) => {
      const first = viewableItems.find((v) => v.isViewable && v.item);
      setActivePostId(first?.item?.id ?? null);
      for (const v of viewableItems) {
        if (v.isViewable && v.item) recordPostView(v.item.id);
      }
    }
  ).current;

  const openReactionCapture = (id: string) => {
    sheet.open(<ReactionCaptureSheet postId={id} onClose={sheet.close} />);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title={title} sub={sub} right={headerRight} />
      <FlashList
        data={posts}
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
          isLoading ? (
            <View>
              <PostCardSkeleton />
              <PostCardSkeleton />
            </View>
          ) : (
            <>{empty}</>
          )
        }
      />
    </View>
  );
}
