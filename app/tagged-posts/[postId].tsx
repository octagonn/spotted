import { useLocalSearchParams } from "expo-router";
import { useMemo } from "react";
import { Text } from "react-native";
import { useQuery } from "@tanstack/react-query";

import { PostPagerScreen } from "@/components/post/PostPagerScreen";
import { useTaggedPosts } from "@/hooks/queries/useTaggedPosts";
import { type FeedMockPost } from "@/lib/redesignData";
import { isSupabaseConfigured, signedPostUrls, supabase } from "@/lib/supabase";
import { relTime } from "@/lib/toFeedPost";
import { colors } from "@/theme/colors";

type TaggedFullRow = {
  id: string;
  media_url: string | null;
  media_urls: string[] | null;
  inset_url: string | null;
  thumbnail_url: string | null;
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
  profiles: { display_name: string; username: string; avatar_url: string | null } | null;
};

/**
 * Full card data for a set of tagged posts. The tagged GRID only holds
 * thumbnails; the pager needs captions, music, insets and each post's OWNER
 * (tagged posts belong to different people). One query, one batched sign.
 */
function useTaggedFeed(postIds: string[]) {
  return useQuery({
    queryKey: ["tagged-feed", postIds.join(",")],
    enabled: isSupabaseConfigured && postIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<TaggedFullRow[]> => {
      const { data, error } = await supabase
        .from("posts")
        .select(
          "id, media_url, media_urls, inset_url, thumbnail_url, media_type, caption, created_at, music_title, music_artist, music_preview_url, music_artwork_url, music_clip_start, video_trim_start, video_trim_end, profiles:user_id(display_name, username, avatar_url)"
        )
        .in("id", postIds);
      if (error) throw error;
      const rows = (data ?? []) as unknown as TaggedFullRow[];
      const signed = await signedPostUrls(
        rows.flatMap((row) => [row.media_url, row.inset_url, row.thumbnail_url, ...(row.media_urls ?? [])])
      );
      const resolve = (path: string | null): string | null => {
        if (!path) return null;
        if (path.startsWith("http")) return path;
        return signed.get(path) ?? null;
      };
      return rows.map((row) => ({
        ...row,
        media_url: resolve(row.media_url),
        inset_url: resolve(row.inset_url),
        thumbnail_url: resolve(row.thumbnail_url),
        media_urls: row.media_urls?.length
          ? row.media_urls.map(resolve).filter((u): u is string => Boolean(u))
          : row.media_urls
      }));
    }
  });
}

/**
 * Tagged pager: every post this user is tagged in as ONE vertical feed,
 * landing on the tapped tile. The grid used to open each post's day viewer
 * individually — see one, back out, open the next ("can't swipe through
 * tagged posts, it makes you go through one at a time").
 */
export default function TaggedPostsScreen() {
  const { postId, user } = useLocalSearchParams<{ postId: string; user?: string }>();
  const tagged = useTaggedPosts(user ?? null);
  const orderedIds = useMemo(() => (tagged.data ?? []).map((post) => post.id), [tagged.data]);
  const full = useTaggedFeed(orderedIds);

  const feedPosts: FeedMockPost[] = useMemo(() => {
    const byId = new Map((full.data ?? []).map((row) => [row.id, row]));
    // The tagged list's order (newest first) is the grid's order — keep it.
    return orderedIds
      .map((id) => byId.get(id))
      .filter((row): row is TaggedFullRow => Boolean(row))
      .map((row) => {
        const isVideo = row.media_type === "video";
        return {
          id: row.id,
          kind: isVideo ? ("video" as const) : ("fb" as const),
          user: {
            name: row.profiles?.display_name ?? "Member",
            handle: row.profiles?.username ?? "member",
            avatarUrl: row.profiles?.avatar_url ?? null
          },
          time: relTime(row.created_at),
          mediaUri: isVideo ? undefined : row.media_url ?? undefined,
          video:
            isVideo && row.media_url
              ? {
                  uri: row.media_url,
                  trimStart: row.video_trim_start ?? 0,
                  trimEnd: row.video_trim_end ?? 0,
                  posterUrl: row.thumbnail_url
                }
              : undefined,
          insetUri: row.inset_url ?? undefined,
          mediaUris: !isVideo && (row.media_urls?.length ?? 0) > 1 ? (row.media_urls as string[]) : undefined,
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
      });
  }, [orderedIds, full.data]);

  return (
    <PostPagerScreen
      title="Tagged"
      sub={feedPosts.length ? `${feedPosts.length} ${feedPosts.length === 1 ? "post" : "posts"}` : undefined}
      posts={feedPosts}
      initialPostId={postId}
      isLoading={tagged.isLoading || full.isLoading}
      empty={
        <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
          No tagged posts.
        </Text>
      }
    />
  );
}
