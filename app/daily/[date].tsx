import { useIsFocused } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams } from "expo-router";
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

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "9:41 AM" stamp for a same-day post. */
function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Day viewer (rework 1a): a calendar day is the unit of history. Opening a day
 * shows EVERY post from that local date — each as the full feed card with its
 * photo carousel + attached workout slides — oldest first, so the day reads
 * top to bottom. `?user=<id>` opens someone else's day (RLS gates visibility);
 * `?post=<id>` lands on a specific post within the day.
 */
export default function DayScreen() {
  const { date = "", user, post } = useLocalSearchParams<{ date: string; user?: string; post?: string }>();
  const sheet = useSheet();
  const myProfile = useMyProfile();
  const otherProfile = useProfileById(user);
  const ownerId = user ?? myProfile.data?.id;
  const owner = user ? otherProfile.data : myProfile.data;
  const posts = useSignedUserPosts(ownerId);

  const parts = date.split("-").map(Number);
  const day = Number.isFinite(parts[2]) ? parts[2] : 1;
  const month = MONTHS[(parts[1] || 1) - 1] ?? "";

  const name = owner?.display_name ?? "You";
  const handle = owner?.username ?? "you";
  const avatarUrl = owner?.avatar_url ?? null;

  // Every post from this local day, oldest first.
  const dayPosts = useMemo(
    () =>
      (posts.data ?? [])
        .filter((p) => p.hasMedia && localDateKey(new Date(p.created_at)) === date)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [posts.data, date]
  );

  const feedPosts: FeedMockPost[] = useMemo(
    () =>
      dayPosts.map((p: SignedPost) => ({
        id: p.id,
        user: { name, handle, avatarUrl },
        time: timeOf(p.created_at),
        kind: p.mediaType === "video" ? "video" : "fb",
        mediaUri: p.mediaType === "video" ? undefined : p.media_url ?? undefined,
        video: p.mediaType === "video" && p.media_url ? { uri: p.media_url, trimStart: 0, trimEnd: 0 } : undefined,
        insetUri: p.inset_url ?? undefined,
        mediaUris: p.media_urls?.length ? p.media_urls : undefined,
        workouts: p.workouts.length ? p.workouts : undefined,
        caption: p.caption ?? undefined,
        music: p.music
          ? { title: p.music.title, artist: p.music.artist, artworkUrl: p.music.artworkUrl, previewUrl: p.music.previewUrl, clipStart: p.music.clipStart }
          : undefined,
        reactions: [],
        comments: []
      })),
    [dayPosts, name, handle, avatarUrl]
  );

  const initialIndex = Math.max(
    0,
    feedPosts.findIndex((p) => p.id === post)
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader
        title={`${month} ${day}`}
        sub={
          feedPosts.length
            ? `@${handle} · ${feedPosts.length} ${feedPosts.length === 1 ? "post" : "posts"}`
            : `@${handle}`
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
          <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
            {posts.isLoading ? "Loading…" : "No posts saved for this day."}
          </Text>
        }
      />
    </View>
  );
}
