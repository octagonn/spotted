import { useIsFocused, useScrollToTop } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, RefreshControl, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LockOverlay } from "@/components/post/LockOverlay";
import { StoriesRail } from "@/components/post/StoriesRail";
import { PostCard } from "@/components/post/PostCard";
import { ReactionCaptureSheet } from "@/components/post/ReactionCaptureSheet";
import { Pressable } from "@/components/ui/Pressable";
import { Segmented } from "@/components/ui/Segmented";
import { PostCardSkeleton } from "@/components/ui/Skeleton";
import { useSheet } from "@/components/ui/Sheet";
import { useActivityUnreadCount } from "@/hooks/queries/useNotifications";
import { useFeed } from "@/hooks/queries/useFeed";
import { useFriends } from "@/hooks/queries/useFriends";
import { type FeedMockPost } from "@/lib/redesignData";
import { usePostedState } from "@/hooks/queries/usePostedState";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";

const NAV_H = 84;

/** Deterministic shuffle (seeded) so a refresh reorders the feed but stays
 * stable between renders of the same refresh. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Map a real Supabase post onto the redesign post card shape. */
function toMockShape(post: import("@/types/domain").FeedPost): FeedMockPost {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(post.created_at).getTime()) / 60000));
  const time =
    minutes < 60
      ? `${minutes}m`
      : minutes < 60 * 24
        ? `${Math.round(minutes / 60)}h`
        : `${Math.round(minutes / (60 * 24))}d`;
  const isVideo = post.media_type === "video";
  const trimStart = post.video_trim_start ?? 0;
  const trimEnd = post.video_trim_end ?? 0;
  const clipSeconds = trimEnd > trimStart ? Math.round(trimEnd - trimStart) : 0;
  return {
    id: post.id,
    kind: isVideo ? "lift" : "fb",
    user: { name: post.profile.display_name, handle: post.profile.username, avatarUrl: post.profile.avatar_url },
    gym: post.gym?.name,
    altLoc: post.gym ? undefined : post.location_kind === "home" ? "Home Gym" : "Unlisted location",
    time,
    mediaUri: post.media_url,
    mediaUris: !isVideo && (post.media_urls?.length ?? 0) > 1 ? (post.media_urls as string[]) : undefined,
    video: isVideo && post.media_url ? { uri: post.media_url, trimStart, trimEnd } : undefined,
    lift: isVideo ? { lift: post.lift_name ?? "Lift", weight: post.lift_weight ?? "" } : undefined,
    duration: clipSeconds ? `0:${String(clipSeconds).padStart(2, "0")}` : undefined,
    caption: post.caption ?? undefined,
    music: post.music_title
      ? {
          title: post.music_title,
          artist: post.music_artist ?? "",
          artworkUrl: post.music_artwork_url,
          previewUrl: post.music_preview_url,
          clipStart: post.music_clip_start
        }
      : undefined,
    taggedFriends: post.tag_usernames?.length
      ? post.tag_usernames.map((u) => ({ handle: u, name: u }))
      : undefined,
    photoTags: post.photo_tags?.length ? post.photo_tags : undefined,
    answeredCall: post.answered_call ?? undefined,
    workouts: post.attached_workouts?.length
      ? post.attached_workouts.map((w) => ({
          id: w.id,
          name: w.name,
          durationSeconds: w.durationSeconds,
          exercises: w.exercises as never,
          isSecond: w.isSecond
        }))
      : undefined,
    reactions: [],
    comments: []
  };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("Friends");
  // Feed lock resets at LOCAL midnight (spec A): locked until today's post.
  // Server truth (UTC timestamps compared in device tz) + optimistic local flag.
  const { postedToday, resolved: postedResolved } = usePostedState();
  const sheet = useSheet();
  const feed = useFeed();
  const router = useRouter();
  const unreadCount = useActivityUnreadCount();

  const locked = !postedToday;
  const userId = useAuthStore((state) => state.userId);
  const friends = useFriends();
  const friendIds = useMemo(() => new Set((friends.data ?? []).map((f) => f.id)), [friends.data]);
  // Pull-to-refresh bumps this to reshuffle the visible order.
  const [shuffleSeed, setShuffleSeed] = useState(0);

  // Friends tab: you + your crew. Public tab: ONLY people you haven't added
  // (discovery) — your friends' content stays in the Friends tab. No fixtures.
  const posts = useMemo(() => {
    const rows = feed.data?.pages.flat() ?? [];
    if (tab === "Friends") {
      // Home feed is strictly reverse-chronological — newest post always at the
      // top. No ranking, no engagement weighting, no shuffle (BeReal-style).
      const scoped = rows
        .filter((p) => p.user_id === userId || friendIds.has(p.user_id))
        .slice()
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      return scoped.map(toMockShape);
    }
    // Public/discovery: reshuffles on pull-to-refresh.
    const scoped = rows.filter((p) => p.user_id !== userId && !friendIds.has(p.user_id));
    const mapped = scoped.map(toMockShape);
    return shuffleSeed > 0 ? seededShuffle(mapped, shuffleSeed) : mapped;
  }, [feed.data, tab, userId, friendIds, shuffleSeed]);

  // Lock-screen social proof (spec A): the distinct friends who posted today
  // (with avatars for the stack) + how many posts wait behind the glass.
  const lockStats = useMemo(() => {
    const today = new Date().toDateString();
    const rows = feed.data?.pages.flat() ?? [];
    const byPoster = new Map<string, { id: string; name: string; avatarUrl: string | null }>();
    let lockedCount = 0;
    for (const p of rows) {
      if (p.user_id === userId) continue;
      lockedCount += 1;
      if (friendIds.has(p.user_id) && new Date(p.created_at).toDateString() === today && !byPoster.has(p.user_id)) {
        byPoster.set(p.user_id, {
          id: p.user_id,
          name: p.profile?.display_name ?? p.profile?.username ?? "Friend",
          avatarUrl: p.profile?.avatar_url ?? null
        });
      }
    }
    return { posters: [...byPoster.values()], count: byPoster.size, lockedCount };
  }, [feed.data, friendIds, userId]);

  const listRef = useRef<React.ComponentRef<typeof FlashList<FeedMockPost>>>(null);
  // Tapping the Home tab while on the feed scrolls back to the top.
  useScrollToTop(listRef as never);

  const refresh = () => {
    setShuffleSeed((s) => s + 1);
    void feed.refetch();
  };

  const openReactionCapture = (postId: string) => {
    sheet.open(<ReactionCaptureSheet postId={postId} onClose={sheet.close} />);
  };

  // Which post's music is audible: the first mostly-visible post with a
  // playable track — and only while this screen is focused, so opening a
  // story (which renders on top of the mounted feed) silences the feed.
  const isFocused = useIsFocused();
  // The single most-visible post drives BOTH music and video autoplay (IG-style).
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { isViewable: boolean; item?: FeedMockPost }[] }) => {
      const first = viewableItems.find((v) => v.isViewable && v.item);
      setActivePostId(first?.item?.id ?? null);
    }
  ).current;

  return (
    // Top inset lives on the container (not the scroll content) so the
    // pull-to-refresh spinner appears below the notch where it's visible.
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <FlashList
        ref={listRef}
        data={posts}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching}
            onRefresh={refresh}
            tintColor={colors.white}
          />
        }
        contentContainerStyle={{ paddingBottom: NAV_H + 12 }}
        keyExtractor={(item: FeedMockPost) => item.id}
        ListHeaderComponent={
          <View>
            {/* App head — brand (§2.4) */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8, paddingHorizontal: 18, paddingBottom: 4 }}>
              <RNText
                allowFontScaling={false}
                style={{
                  fontFamily: "Boldonse_400Regular",
                  fontSize: 19,
                  lineHeight: 19 * 1.4 + 8,
                  letterSpacing: 19 * 0.01,
                  color: colors.white,
                  includeFontPadding: false
                }}
              >
                SPOTTED
              </RNText>
              <Pressable
                onPress={() => router.push("/inbox")}
                accessibilityLabel="Notifications"
                hitSlop={11}
                style={{ width: 44, height: 44, alignItems: "flex-end", justifyContent: "center" }}
              >
                <View>
                  <Bell size={26} color={colors.white} strokeWidth={2} />
                  {unreadCount > 0 ? (
                    <View
                      style={{
                        position: "absolute",
                        top: -1,
                        right: -1,
                        width: 9,
                        height: 9,
                        borderRadius: 5,
                        backgroundColor: colors.gold,
                        borderWidth: 1.5,
                        borderColor: colors.black
                      }}
                    />
                  ) : null}
                </View>
              </Pressable>
            </View>
            {tab === "Friends" ? <StoriesRail /> : null}
            <Segmented options={["Friends", "Public"]} value={tab} onChange={setTab} />
          </View>
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // Keyset pagination: pull older posts as the user scrolls down (F1).
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator color={colors.fog} />
            </View>
          ) : null
        }
        renderItem={({ item }: { item: FeedMockPost }) => (
          <PostCard post={item} locked={locked} audible={isFocused && item.id === activePostId} onReact={openReactionCapture} />
        )}
        ListEmptyComponent={
          feed.isLoading ? (
            // Skeleton placeholders instead of a blank screen while loading.
            <View>
              <PostCardSkeleton />
              <PostCardSkeleton />
            </View>
          ) : (
            <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40 }}>
              <RNText style={{ fontSize: 13, color: colors.fog, textAlign: "center", lineHeight: 19 }}>
                {tab === "Friends"
                  ? "Nothing from your crew yet. Add friends or post today's SPOTTED."
                  : "No public posts yet. Set your profile to Public and post to show up here."}
              </RNText>
            </View>
          )
        }
      />
      {/* Only gate once posted-state is KNOWN — rendering the overlay while
          hydration/server-check are pending flashed it at every cold open. */}
      {locked && postedResolved ? (
        <LockOverlay
          friendsPostedToday={lockStats.count}
          posters={lockStats.posters}
          lockedCount={lockStats.lockedCount}
        />
      ) : null}
    </View>
  );
}
