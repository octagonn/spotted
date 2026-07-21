import { useIsFocused } from "@react-navigation/native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Bell } from "lucide-react-native";
import { useMemo, useRef, useState } from "react";
import { RefreshControl, Text as RNText, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LockOverlay } from "@/components/post/LockOverlay";
import { StoriesRail } from "@/components/post/StoriesRail";
import { PostCard } from "@/components/post/PostCard";
import { ReactionCaptureSheet } from "@/components/post/ReactionCaptureSheet";
import { Pressable } from "@/components/ui/Pressable";
import { Segmented } from "@/components/ui/Segmented";
import { useSheet } from "@/components/ui/Sheet";
import { useActivityUnreadCount } from "@/hooks/queries/useNotifications";
import { useFeed } from "@/hooks/queries/useFeed";
import { useFriends } from "@/hooks/queries/useFriends";
import { type FeedMockPost } from "@/lib/redesignData";
import { usePostedState } from "@/hooks/queries/usePostedState";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";

const NAV_H = 84;

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
    reactions: [],
    comments: []
  };
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState("Friends");
  // Feed stays unlocked for a week after the last daily post (server-derived).
  const { postedThisWeek } = usePostedState();
  const sheet = useSheet();
  const feed = useFeed();
  const router = useRouter();
  const unreadCount = useActivityUnreadCount();

  const locked = !postedThisWeek;
  const userId = useAuthStore((state) => state.userId);
  const friends = useFriends();
  const friendIds = useMemo(() => new Set((friends.data ?? []).map((f) => f.id)), [friends.data]);
  // Friends tab: you + your crew. Public tab: every real post RLS lets you see
  // (public-visibility profiles included). No fixtures anywhere.
  const posts = useMemo(() => {
    const rows = feed.data ?? [];
    const scoped = tab === "Friends"
      ? rows.filter((p) => p.user_id === userId || friendIds.has(p.user_id))
      : rows;
    return scoped.map(toMockShape);
  }, [feed.data, tab, userId, friendIds]);

  const openReactionCapture = (postId: string) => {
    sheet.open(<ReactionCaptureSheet postId={postId} onClose={sheet.close} />);
  };

  // Which post's music is audible: the first mostly-visible post with a
  // playable track — and only while this screen is focused, so opening a
  // story (which renders on top of the mounted feed) silences the feed.
  const isFocused = useIsFocused();
  const [audiblePostId, setAudiblePostId] = useState<string | null>(null);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 55 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: { isViewable: boolean; item?: FeedMockPost }[] }) => {
      const first = viewableItems.find((v) => v.isViewable && v.item?.music?.previewUrl);
      setAudiblePostId(first?.item?.id ?? null);
    }
  ).current;

  return (
    // Top inset lives on the container (not the scroll content) so the
    // pull-to-refresh spinner appears below the notch where it's visible.
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top }}>
      <FlashList
        data={posts}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching}
            onRefresh={() => void feed.refetch()}
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
              <Pressable onPress={() => router.push("/inbox")} accessibilityLabel="Notifications" hitSlop={8}>
                <View>
                  <Bell size={23} color={colors.white} strokeWidth={2} />
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
        renderItem={({ item }: { item: FeedMockPost }) => (
          <PostCard post={item} locked={locked} audible={isFocused && item.id === audiblePostId} onReact={openReactionCapture} />
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingTop: 60, paddingHorizontal: 40 }}>
            <RNText style={{ fontSize: 13, color: colors.fog, textAlign: "center", lineHeight: 19 }}>
              {feed.isLoading
                ? "Loading your feed…"
                : tab === "Friends"
                  ? "Nothing from your crew yet. Add friends or post today's SPOTTED."
                  : "No public posts yet. Set your profile to Public and post to show up here."}
            </RNText>
          </View>
        }
      />
      {locked ? <LockOverlay /> : null}
    </View>
  );
}
