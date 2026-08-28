import { useLocalSearchParams, useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useMemo } from "react";
import { ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PostCard } from "@/components/post/PostCard";
import { ReactionCaptureSheet } from "@/components/post/ReactionCaptureSheet";
import { useSheet } from "@/components/ui/Sheet";
import { Pressable } from "@/components/ui/Pressable";
import { PostCardSkeleton } from "@/components/ui/Skeleton";
import { type FeedMockPost } from "@/lib/redesignData";
import { isSupabaseConfigured, signedPostUrls, supabase } from "@/lib/supabase";
import { colors } from "@/theme/colors";

/** "3m" / "5h" / "2d" relative label. */
function relTime(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (60 * 24))}d`;
}

type PostRow = {
  id: string;
  user_id: string;
  media_url: string;
  media_urls: string[] | null;
  inset_url: string | null;
  media_type: string;
  caption: string | null;
  created_at: string;
  music_title: string | null;
  music_artist: string | null;
  music_preview_url: string | null;
  music_artwork_url: string | null;
  music_clip_start: number;
  video_trim_start: number | null;
  video_trim_end: number | null;
  lift_name: string | null;
  lift_weight: string | null;
  moderation_status: string;
  profiles: { display_name: string; username: string; avatar_url: string | null } | null;
  gyms: { name: string } | null;
  location_kind: string;
};

/** One post by id (RLS gates visibility), signed + mapped for PostCard. */
function usePostById(postId?: string) {
  return useQuery({
    queryKey: ["post-detail", postId],
    enabled: isSupabaseConfigured && Boolean(postId),
    staleTime: 30_000,
    queryFn: async (): Promise<PostRow | null> => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, user_id, media_url, media_urls, inset_url, media_type, caption, created_at, music_title, music_artist, music_preview_url, music_artwork_url, music_clip_start, video_trim_start, video_trim_end, lift_name, lift_weight, moderation_status, location_kind, profiles:user_id(display_name, username, avatar_url), gyms:gym_id(name)"
        )
        .eq("id", postId as string)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as PostRow;
      const signed = await signedPostUrls([row.media_url, row.inset_url, ...(row.media_urls ?? [])]);
      const resolve = (path: string | null) => (path ? (signed.get(path) ?? (path.startsWith("http") ? path : "")) : null);
      return {
        ...row,
        media_url: resolve(row.media_url) ?? "",
        inset_url: resolve(row.inset_url),
        media_urls: row.media_urls?.length
          ? row.media_urls.map(resolve).filter((u): u is string => Boolean(u))
          : row.media_urls
      };
    }
  });
}

/**
 * Single-post view — where a notification tap about a post lands. Renders the
 * real PostCard (was a leftover "VIEWERS" list screen that had nothing to do
 * with the notification tapped).
 */
export default function PostDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const post = usePostById(params.id);

  const mock: FeedMockPost | null = useMemo(() => {
    const row = post.data;
    if (!row) return null;
    const isVideo = row.media_type === "video";
    const trimStart = row.video_trim_start ?? 0;
    const trimEnd = row.video_trim_end ?? 0;
    return {
      id: row.id,
      kind: isVideo ? "lift" : "fb",
      user: {
        name: row.profiles?.display_name ?? "Member",
        handle: row.profiles?.username ?? "member",
        avatarUrl: row.profiles?.avatar_url ?? null
      },
      gym: row.gyms?.name,
      altLoc: row.gyms ? undefined : row.location_kind === "home" ? "Custom Location" : "Unlisted location",
      time: relTime(row.created_at),
      mediaUri: isVideo ? undefined : row.media_url || undefined,
      insetUri: row.inset_url ?? undefined,
      mediaUris: !isVideo && (row.media_urls?.length ?? 0) > 1 ? (row.media_urls as string[]) : undefined,
      video: isVideo && row.media_url ? { uri: row.media_url, trimStart, trimEnd } : undefined,
      lift: isVideo ? { lift: row.lift_name ?? "Lift", weight: row.lift_weight ?? "" } : undefined,
      caption: row.caption ?? undefined,
      music: row.music_title
        ? {
            title: row.music_title,
            artist: row.music_artist ?? "",
            artworkUrl: row.music_artwork_url,
            previewUrl: row.music_preview_url,
            clipStart: row.music_clip_start
          }
        : undefined,
      reactions: [],
      comments: []
    };
  }, [post.data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 8
        }}
      >
        <Text style={{ fontFamily: "Geist_700Bold", fontSize: 17, color: colors.white }}>Post</Text>
        <Pressable onPress={() => router.back()} accessibilityLabel="Close post" hitSlop={10}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.graphite, alignItems: "center", justifyContent: "center" }}>
            <X size={18} color={colors.white} strokeWidth={2.2} />
          </View>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        {post.isLoading ? (
          <PostCardSkeleton />
        ) : mock ? (
          // onReact: the tag-notification path lands HERE, and without it the
          // live-reaction button was a silent no-op — "can't react until you
          // view it in the main feed". zoomPreview off per PostCardProps: this
          // screen renders above the root overlay host, so the full-screen
          // zoom would be invisible; the in-place zoom takes over.
          <PostCard
            post={mock}
            audible
            zoomPreview={false}
            onReact={(postId) => sheet.open(<ReactionCaptureSheet postId={postId} onClose={sheet.close} />)}
          />
        ) : (
          <Text style={{ paddingTop: 60, textAlign: "center", fontSize: 13.5, color: colors.fog, paddingHorizontal: 40 }}>
            This post is no longer available.
          </Text>
        )}
      </ScrollView>
    </View>
  );
}
