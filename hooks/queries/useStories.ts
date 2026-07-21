import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { compressStoryPhoto } from "@/lib/posts";
import { isSupabaseConfigured, signedPostUrl, supabase } from "@/lib/supabase";
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
};

export type StoryGroup = {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  isMe: boolean;
  hasUnseen: boolean;
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
            "id, user_id, media_url, created_at, music_title, music_artist, music_preview_url, music_artwork_url, music_clip_start, profiles:user_id(display_name, username, avatar_url), story_tags(profile:user_id(id, username))"
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
        music_title: string | null;
        music_artist: string | null;
        music_preview_url: string | null;
        music_artwork_url: string | null;
        music_clip_start: number;
        profiles: { display_name: string; username: string; avatar_url: string | null } | null;
        story_tags: { profile: { id: string; username: string } | null }[] | null;
      }[];

      const byUser = new Map<string, StoryGroup>();
      for (const row of rows) {
        let group = byUser.get(row.user_id);
        if (!group) {
          group = {
            userId: row.user_id,
            name: row.profiles?.display_name ?? "Someone",
            username: row.profiles?.username ?? "someone",
            avatarUrl: row.profiles?.avatar_url ?? null,
            isMe: row.user_id === userId,
            hasUnseen: false,
            stories: []
          };
          byUser.set(row.user_id, group);
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
            .map((p) => ({ userId: p.id, username: p.username }))
        });
        if (!storySeen && row.user_id !== userId) {
          group.hasUnseen = true;
        }
      }

      return [...byUser.values()].sort((a, b) => {
        if (a.isMe !== b.isMe) return a.isMe ? -1 : 1;
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
    mutationFn: async ({ photoUri, music, tagUserIds }: PostStoryInput) => {
      if (!isSupabaseConfigured || !userId) return;
      const uploadUri = await compressStoryPhoto(photoUri);
      const response = await fetch(uploadUri);
      const body = await response.arrayBuffer();
      if (body.byteLength === 0) throw new Error("The photo could not be read.");
      const path = `${userId}/story-${Date.now()}.jpg`;
      const upload = await supabase.storage.from("posts").upload(path, body, {
        contentType: "image/jpeg",
        upsert: false
      });
      if (upload.error) throw upload.error;
      const insert = await supabase.from("stories").insert({
        user_id: userId,
        media_url: path,
        music_title: music?.title ?? null,
        music_artist: music?.artist ?? null,
        music_preview_url: music?.previewUrl ?? null,
        music_artwork_url: music?.artworkUrl ?? null,
        music_clip_start: music?.clipStart ?? 0
      }).select("id").single();
      if (insert.error) {
        await supabase.storage.from("posts").remove([path]).catch(() => {});
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
    onMutate: async ({ photoUri, music }) => {
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
        tags: []
      };
      queryClient.setQueryData<StoryGroup[]>(["stories", userId], (old) => {
        const groups = old ? old.map((g) => ({ ...g, stories: [...g.stories] })) : [];
        const meIdx = groups.findIndex((g) => g.isMe);
        if (meIdx >= 0) {
          groups[meIdx].stories.push(tempStory);
        } else {
          groups.unshift({ userId, name: "You", username: "", avatarUrl: null, isMe: true, hasUnseen: false, stories: [tempStory] });
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

/** Mark a story seen. Invalidates ["stories"] so the rail ring dims and the
 * viewed group drops to the end of the row. */
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
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["stories"] })
  });
}
