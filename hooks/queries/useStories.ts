import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { compressStoryPhoto } from "@/lib/posts";
import { removePostObjects, uploadPostObject } from "@/lib/r2";
import { isSupabaseConfigured, signedPostUrl, supabase } from "@/lib/supabase";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { useAuthStore } from "@/stores/auth";

export type StoryMusic = {
  title: string;
  artist: string;
  artworkUrl: string | null;
  previewUrl: string | null;
  clipStart: number;
};

export type StoryTag = { userId: string; username: string };

export type StoryItem = {
  id: string;
  mediaUrl: string | null;
  /** Raw storage path (for story-reply thumbnails). */
  mediaPath: string | null;
  createdAt: string;
  seen: boolean;
  music: StoryMusic | null;
  tags: StoryTag[];
  /** Set when this story RESHARES a post the owner was tagged in — the viewer
   *  shows a credit chip that opens the original. */
  sharedPostId: string | null;
};

export type StoryGroup = {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  isMe: boolean;
  hasUnseen: boolean;
  /** Set when this group is a PRIVATE story (audience-limited list). Posts to
   *  a private story group separately from the owner's main story. */
  privateStoryId: string | null;
  privateStoryName: string | null;
  stories: StoryItem[];
};

/**
 * Active story groups (self + friends), ordered self-first then unseen-first —
 * the data behind the story rail and the tappable viewer. Each item's media
 * path is resolved to a signed URL.
 */
export function useStories() {
  const userId = useAuthStore((state) => state.userId);
  return useQuery({
    queryKey: ["stories", userId],
    enabled: isSupabaseConfigured && Boolean(userId),
    staleTime: 30_000,
    refetchOnWindowFocus: "always",
    queryFn: async (): Promise<StoryGroup[]> => {
      const nowIso = new Date().toISOString();
      const [storiesResult, viewsResult] = await Promise.all([
        supabase
          .from("stories")
          .select(
            "id, user_id, media_url, created_at, private_story_id, shared_post_id, music_title, music_artist, music_preview_url, music_artwork_url, music_clip_start, private_stories(name), profiles:user_id(display_name, username, avatar_url), story_tags(profile:user_id(id, username))"
          )
          .gt("expires_at", nowIso)
          .order("created_at", { ascending: true }),
        supabase.from("story_views").select("story_id").eq("viewer_id", userId as string)
      ]);
      if (storiesResult.error) throw storiesResult.error;
      const seen = new Set((viewsResult.data ?? []).map((row) => row.story_id));

      const rows = (storiesResult.data ?? []) as unknown as {
        id: string;
        user_id: string;
        media_url: string;
        created_at: string;
        private_story_id: string | null;
        shared_post_id: string | null;
        music_title: string | null;
        music_artist: string | null;
        music_preview_url: string | null;
        music_artwork_url: string | null;
        music_clip_start: number;
        private_stories: { name: string } | null;
        profiles: { display_name: string; username: string; avatar_url: string | null } | null;
        story_tags: { profile: { id: string; username: string } | null }[] | null;
      }[];

      // Private stories group separately from the owner's main story.
      const byUser = new Map<string, StoryGroup>();
      for (const row of rows) {
        const groupKey = `${row.user_id}:${row.private_story_id ?? "main"}`;
        let group = byUser.get(groupKey);
        if (!group) {
          group = {
            userId: row.user_id,
            name: row.profiles?.display_name ?? "Someone",
            username: row.profiles?.username ?? "someone",
            avatarUrl: row.profiles?.avatar_url ?? null,
            isMe: row.user_id === userId,
            hasUnseen: false,
            privateStoryId: row.private_story_id,
            privateStoryName: row.private_stories?.name ?? null,
            stories: []
          };
          byUser.set(groupKey, group);
        }
        let media: string | null = row.media_url;
        if (media && !media.startsWith("http")) {
          try {
            media = await signedPostUrl(media);
          } catch {
            media = null;
          }
        }
        const storySeen = seen.has(row.id);
        group.stories.push({
          id: row.id,
          mediaUrl: media,
          mediaPath: row.media_url,
          createdAt: row.created_at,
          seen: storySeen,
          music: row.music_title
            ? {
                title: row.music_title,
                artist: row.music_artist ?? "",
                artworkUrl: row.music_artwork_url,
                previewUrl: row.music_preview_url,
                clipStart: row.music_clip_start ?? 0
              }
            : null,
          tags: (row.story_tags ?? [])
            .map((t) => t.profile)
            .filter((p): p is { id: string; username: string } => Boolean(p))
            .map((p) => ({ userId: p.id, username: p.username })),
          sharedPostId: row.shared_post_id ?? null
        });
        if (!storySeen && row.user_id !== userId) {
          group.hasUnseen = true;
        }
      }

      return [...byUser.values()].sort((a, b) => {
        if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
        // Own groups: main story before private lists.
        if (a.isMe && b.isMe) {
          const aPriv = a.privateStoryId ? 1 : 0;
          const bPriv = b.privateStoryId ? 1 : 0;
          if (aPriv !== bPriv) return aPriv - bPriv;
          return 0;
        }
        if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
        return 0;
      });
    }
  });
}

export type PostStoryInput = {
  photoUri: string;
  music?: StoryMusic | null;
  /** Tagged friend ids — rendered as tappable chips when the story is viewed. */
  tagUserIds?: string[];
  /** Raw text overlays (baked into the image) — saved for slur scanning. */
  overlayText?: string;
  /** Post into a private story (audience = its member list) instead of the main story. */
  privateStoryId?: string | null;
  /** Display name of that private story (for the optimistic rail group). */
  privateStoryName?: string | null;
};

/** Upload a story photo (reuses the posts bucket) and insert the story row. */
export function usePostStory() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    // #24: retry transient upload/insert failures (poor connectivity) with
    // backoff before surfacing an error, so a flaky network doesn't drop a story.
    retry: 3,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    mutationFn: async ({ photoUri, music, tagUserIds, overlayText, privateStoryId }: PostStoryInput) => {
      if (!isSupabaseConfigured || !userId) return;
      const uploadUri = await compressStoryPhoto(photoUri);
      const response = await fetch(uploadUri);
      const body = await response.arrayBuffer();
      if (body.byteLength === 0) throw new Error("The photo could not be read.");
      const path = await uploadPostObject(`${userId}/story-${Date.now()}.jpg`, body, "image/jpeg");
      const insert = await supabase.from("stories").insert({
        user_id: userId,
        media_url: path,
        private_story_id: privateStoryId ?? null,
        music_title: music?.title ?? null,
        music_artist: music?.artist ?? null,
        music_preview_url: music?.previewUrl ?? null,
        music_artwork_url: music?.artworkUrl ?? null,
        music_clip_start: music?.clipStart ?? 0,
        overlay_text: overlayText && overlayText.trim() ? overlayText.trim().slice(0, 500) : null
      }).select("id").single();
      if (insert.error) {
        await removePostObjects([path]).catch(() => {});
        throw insert.error;
      }
      if (tagUserIds && tagUserIds.length > 0) {
        const { error: tagError } = await supabase
          .from("story_tags")
          .insert(tagUserIds.map((id) => ({ story_id: insert.data.id, user_id: id })));
        if (tagError) {
          // Non-fatal — the story is live even if tags fail.
        }
      }
    },
    // Optimistic: drop a temp story into your own group with the LOCAL photo uri
    // so the "Your story" ring + profile reflect it instantly (no wait for the
    // upload). Reconciled with the server row on settle.
    onMutate: async ({ photoUri, music, privateStoryId, privateStoryName }) => {
      if (!userId) return { prev: undefined };
      await queryClient.cancelQueries({ queryKey: ["stories", userId] });
      const prev = queryClient.getQueryData<StoryGroup[]>(["stories", userId]);
      const tempStory: StoryItem = {
        id: `temp-${new Date().getTime()}`,
        mediaUrl: photoUri,
        mediaPath: null,
        createdAt: new Date().toISOString(),
        seen: true,
        music: music ?? null,
        tags: [],
        sharedPostId: null
      };
      queryClient.setQueryData<StoryGroup[]>(["stories", userId], (old) => {
        const groups = old ? old.map((g) => ({ ...g, stories: [...g.stories] })) : [];
        const targetPs = privateStoryId ?? null;
        const meIdx = groups.findIndex((g) => g.isMe && (g.privateStoryId ?? null) === targetPs);
        if (meIdx >= 0) {
          groups[meIdx].stories.push(tempStory);
        } else {
          groups.unshift({
            userId,
            name: "You",
            username: "",
            avatarUrl: null,
            isMe: true,
            hasUnseen: false,
            privateStoryId: targetPs,
            privateStoryName: privateStoryName ?? null,
            stories: [tempStory]
          });
        }
        // Own group sorts first.
        return groups.sort((a, b) => (a.isMe === b.isMe ? 0 : a.isMe ? -1 : 1));
      });
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev && userId) queryClient.setQueryData(["stories", userId], ctx.prev);
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["stories"] })
  });
}

/** Mark a story seen. Optimistically flags the story in the ["stories", userId]
 * cache (ring dims via seen/hasUnseen) — NO invalidate: a blanket refetch here
 * re-signed every story photo per view. Realtime / the next natural refetch
 * reconciles ordering. */
export function useMarkStoryViewed() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (storyId: string) => {
      if (!isSupabaseConfigured || !userId) return;
      // ignoreDuplicates: plain ON CONFLICT DO NOTHING — the DO UPDATE form
      // needs an UPDATE policy and made every repeat view an RLS error.
      await supabase
        .from("story_views")
        .upsert({ story_id: storyId, viewer_id: userId }, { ignoreDuplicates: true });
      trackAnalyticsEvent("story_viewed");
    },
    onMutate: async (storyId) => {
      await queryClient.cancelQueries({ queryKey: ["stories", userId] });
      const prev = queryClient.getQueryData<StoryGroup[]>(["stories", userId]);
      queryClient.setQueryData<StoryGroup[]>(["stories", userId], (old) =>
        (old ?? []).map((group) => {
          if (!group.stories.some((s) => s.id === storyId && !s.seen)) return group;
          const stories = group.stories.map((s) => (s.id === storyId ? { ...s, seen: true } : s));
          return {
            ...group,
            stories,
            hasUnseen: !group.isMe && stories.some((s) => !s.seen)
          };
        })
      );
      return { prev };
    },
    onError: (_err, _storyId, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["stories", userId], ctx.prev);
    }
  });
}

/**
 * Repost a post you're tagged in to your own story (server-enforced — the
 * repost_tagged_to_story RPC checks the tag, copies the raw media path, and
 * refuses videos and duplicates).
 */
export function useRepostToStory() {
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.userId);
  return useMutation({
    mutationFn: async (postId: string) => {
      if (!isSupabaseConfigured) return;
      const { error } = await supabase.rpc("repost_tagged_to_story" as never, { p_post_id: postId } as never);
      if (error) throw error;
      trackAnalyticsEvent("story_reposted");
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["stories", userId] })
  });
}
