import { useIsFocused, useScrollToTop } from "@react-navigation/native";
import { FlashList, type ListRenderItem } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { WifiOff } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FindFriendsTab } from "@/components/friends/FindFriendsTab";
import { FeedHeader } from "@/components/post/FeedHeader";
import { HomeGymPrompt } from "@/components/post/HomeGymPrompt";
import { LockOverlay } from "@/components/post/LockOverlay";
import { NotSpottedRail } from "@/components/post/NotSpottedRail";
import { PendingPostsStrip } from "@/components/post/PendingPostsStrip";
import { PostCard } from "@/components/post/PostCard";
import { ReactionCaptureSheet } from "@/components/post/ReactionCaptureSheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { EMPTY_ART } from "@/lib/emptyStateArt";
import { Segmented } from "@/components/ui/Segmented";
import { PostCardSkeleton } from "@/components/ui/Skeleton";
import { useSheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useActivityUnreadCount } from "@/hooks/queries/useNotifications";
import { useFeed, useRecordPostViews } from "@/hooks/queries/useFeed";
import { useFriends } from "@/hooks/queries/useFriends";
import { type FeedMockPost } from "@/lib/redesignData";
import { usePostedState } from "@/hooks/queries/usePostedState";
import { useAuthStore } from "@/stores/auth";
import { useTabActions } from "@/stores/tabActions";
import { colors } from "@/theme/colors";
import { TAB_BAR_HEIGHT } from "@/theme/layout";
import { icon, radius, space, tokens } from "@/theme/tokens";
import { trackAnalyticsEvent } from "@/lib/analytics";

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
    authorId: post.user_id,
    user: { name: post.profile.display_name, handle: post.profile.username, avatarUrl: post.profile.avatar_url },
    gym: post.gym?.name,
    altLoc: post.gym ? undefined : post.location_kind === "home" ? "Custom Location" : "Unlisted location",
    time,
    mediaUri: post.media_url,
    // Dual-camera front frame → BeReal corner inset (FbMedia).
    insetUri: post.inset_url ?? undefined,
    underReview: post.moderation_status === "flagged",
    mediaUris: !isVideo && (post.media_urls?.length ?? 0) > 1 ? (post.media_urls as string[]) : undefined,
    video:
      isVideo && post.media_url
        ? { uri: post.media_url, trimStart, trimEnd, posterUrl: post.thumbnail_url }
        : undefined,
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
    taggedFriends: post.tag_usernames?.length ? post.tag_usernames.map((u) => ({ handle: u, name: u })) : undefined,
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
  // No NetInfo dependency: a failed (re)fetch IS the offline signal. Cached
  // rows keep rendering underneath — the banner just explains the silence.
  const offline = feed.isError;
  const router = useRouter();
  const unreadCount = useActivityUnreadCount();

  const locked = !postedToday;
  const userId = useAuthStore((state) => state.userId);
  const friends = useFriends();
  const friendIds = useMemo(() => new Set((friends.data ?? []).map((f) => f.id)), [friends.data]);
  // Friends tab with a KNOWN-empty crew (not loading, not offline): the empty
  // state becomes the friend finder instead of a "go add friends" sign.
  const noFriendsYet = tab === "Friends" && !offline && friends.isSuccess && (friends.data?.length ?? 0) === 0;
  // Pull-to-refresh bumps this to reshuffle the visible order.
  const [shuffleSeed, setShuffleSeed] = useState(0);
  // Spinner ONLY for a manual pull. Binding it to feed.isRefetching made the
  // 60s background refetch (and every focus refetch) pop the spinner and shove
  // the list down — read as "the feed keeps refreshing on its own".
  const [pulling, setPulling] = useState(false);

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
  // Re-tapping the Home tab (custom tab bar) → jump to top + refresh.
  const feedResetNonce = useTabActions((st) => st.feedResetNonce);
  useEffect(() => {
    if (feedResetNonce === 0) return;
    try {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    } catch {
      // list not mounted yet
    }
    void feed.refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedResetNonce]);

  const refresh = () => {
    trackAnalyticsEvent("feed_refreshed", { tab });
    setShuffleSeed((s) => s + 1);
    setPulling(true);
    void feed.refetch().finally(() => setPulling(false));
  };

  const openReactionCapture = useCallback(
    (postId: string) => {
      sheet.open(<ReactionCaptureSheet postId={postId} onClose={sheet.close} />);
    },
    [sheet]
  );

  // Which post's music is audible: the first mostly-visible post with a
  // playable track — and only while this screen is focused, so a screen pushed
  // on top of the mounted feed (profile, camera) silences it.
  const isFocused = useIsFocused();
  // The single most-visible post drives BOTH music and video autoplay (IG-style).
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  // Backend-only view capture: record posts as they become mostly visible —
  // but never while the feed is locked (blurred posts weren't really seen).
  // Refs, because the viewability handler below is created exactly once.
  const recordPostView = useRecordPostViews();
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { isViewable: boolean; item?: FeedMockPost }[] }) => {
      const first = viewableItems.find((v) => v.isViewable && v.item);
      setActivePostId(first?.item?.id ?? null);
      if (!lockedRef.current) {
        for (const v of viewableItems) {
          if (v.isViewable && v.item) recordPostView(v.item.id);
        }
      }
    }
  ).current;

  // Stable renderItem: PostCard is memoized, so only the card whose `audible`
  // flips re-renders when the active post changes — not every visible card.
  const renderItem = useCallback<ListRenderItem<FeedMockPost>>(
    ({ item }) => (
      <PostCard
        post={item}
        locked={locked}
        audible={isFocused && item.id === activePostId}
        onReact={openReactionCapture}
      />
    ),
    [locked, isFocused, activePostId, openReactionCapture]
  );

  // Recycle like with like: a video card's expo-video player must never be
  // handed a photo post (full subtree remount on every recycle otherwise).
  const getItemType = useCallback((item: FeedMockPost) => {
    if (item.video) return "video";
    if (item.workouts?.length) return "workouts";
    if ((item.mediaUris?.length ?? 0) > 1) return "carousel";
    return "photo";
  }, []);

  return (
    // Top inset lives on the container (not the scroll content) so the
    // pull-to-refresh spinner appears below the notch where it's visible.
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <FlashList
        ref={listRef}
        data={posts}
        // FlashList v2 anchors the viewport when items are prepended, so on app
        // open the cached feed painted, the refetch added newer posts ABOVE,
        // and the user landed on yesterday's-last-seen post ("it loads from
        // the last post I saw and I have to scroll up"). Anyone near the top
        // now follows new posts to the top; mid-scroll readers keep their spot.
        maintainVisibleContentPosition={{ autoscrollToTopThreshold: 300 }}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={refresh} tintColor={colors.white} />}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + 12 }}
        keyExtractor={(item: FeedMockPost) => item.id}
        ListHeaderComponent={
          <View>
            <FeedHeader unreadCount={unreadCount} onOpenInbox={() => router.push("/inbox")} />
            {/* Offline: cached posts still render (persisted feed + disk-cached
                media) — this pill says why nothing new is arriving. */}
            {offline ? (
              <View style={{ alignItems: "center", paddingTop: space[2] }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: space[2],
                    backgroundColor: tokens.bg.raised,
                    borderRadius: radius.pill,
                    paddingHorizontal: space[3],
                    paddingVertical: space[2]
                  }}
                >
                  <WifiOff size={12} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
                  <Text variant="label" className="text-fog">
                    You&apos;re offline — showing recent posts
                  </Text>
                </View>
              </View>
            ) : null}
            {/* "Not spotted yet" rail (stories' old slot): friends who haven't
                posted today, one tap to taunt. Behind the LockOverlay until
                the viewer has posted — you earn the right to talk. */}
            {tab === "Friends" ? <NotSpottedRail /> : null}
            {/* One-time nudge to set a home gym; retires itself. */}
            {tab === "Friends" && !locked ? <HomeGymPrompt /> : null}
            <Segmented
              variant="quiet"
              options={["Friends", "Public"]}
              value={tab}
              onChange={setTab}
              style={{ marginTop: space[2], marginBottom: space[3] }}
            />
            {/* Posts captured offline, waiting in the upload queue. */}
            <PendingPostsStrip />
            {/* Zero friends: the Friends feed IS the friend finder. Every other
                screen is empty for the same reason, so the fix lives where
                they're looking instead of a "go add friends" sign. Lives in
                the header (not ListEmptyComponent) so it also shows above the
                viewer's own posts. */}
            {noFriendsYet ? (
              <View style={{ paddingTop: space[2], paddingBottom: space[4] }}>
                <View style={{ paddingHorizontal: space[4], paddingBottom: space[4] }}>
                  <Text variant="title">Your feed is your friends</Text>
                  <Text variant="body" className="text-silver mt-1">
                    Add a few people and their daily SPOTTED shows up here — and you can taunt the ones who skip.
                  </Text>
                </View>
                <FindFriendsTab />
              </View>
            ) : null}
          </View>
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // Keyset pagination: pull older posts as the user scrolls down (F1).
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.6}
        ListFooterComponent={feed.isFetchingNextPage ? <PostCardSkeleton /> : null}
        renderItem={renderItem}
        getItemType={getItemType}
        ListEmptyComponent={
          feed.isLoading ? (
            // Skeleton placeholders instead of a blank screen while loading.
            <View>
              <PostCardSkeleton />
              <PostCardSkeleton />
            </View>
          ) : noFriendsYet ? (
            // The friend finder already sits in the header for this case.
            null
          ) : (
            <EmptyState
              icon={
                offline ? (
                  <WifiOff size={icon.size.md} color={tokens.text.secondary} strokeWidth={icon.stroke.regular} />
                ) : undefined
              }
              art={offline ? undefined : EMPTY_ART.camera}
              title={
                offline ? "You're offline" : tab === "Friends" ? "Nothing from your crew yet" : "No public posts yet"
              }
              body={
                offline
                  ? "Posts will show up as soon as you reconnect."
                  : tab === "Friends"
                    ? "Add friends or post today's SPOTTED."
                    : "Set your profile to Public and post to show up here."
              }
              center
            />
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
