import { type SignedPost } from "@/hooks/queries/useSignedUserPosts";
import { type FeedMockPost } from "@/lib/redesignData";

/** Relative "3h"/"2d" stamp — matches the home feed's formatting. */
export function relTime(iso: string): string {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (60 * 24))}d`;
}

/**
 * Map a signed profile post to the feed-card shape. Shared by every screen
 * that renders a user's posts through PostCard (profile pager, day viewer)
 * so the field mapping can't drift. `time` defaults to the feed's relative
 * stamp; pass an override for screens with their own time format.
 */
export function signedPostToFeedPost(
  post: SignedPost,
  owner: { name: string; handle: string; avatarUrl: string | null },
  time?: string
): FeedMockPost {
  return {
    id: post.id,
    user: { name: owner.name, handle: owner.handle, avatarUrl: owner.avatarUrl },
    time: time ?? relTime(post.created_at),
    kind: post.mediaType === "video" ? "video" : "fb",
    mediaUri: post.mediaType === "video" ? undefined : post.media_url ?? undefined,
    video:
      post.mediaType === "video" && post.media_url
        ? { uri: post.media_url, trimStart: 0, trimEnd: 0, posterUrl: post.thumbnailUrl }
        : undefined,
    insetUri: post.inset_url ?? undefined,
    // Everything from that day: extra photos + attached workout slides.
    mediaUris: post.media_urls?.length ? post.media_urls : undefined,
    workouts: post.workouts.length ? post.workouts : undefined,
    caption: post.caption ?? undefined,
    music: post.music
      ? { title: post.music.title, artist: post.music.artist, artworkUrl: post.music.artworkUrl, previewUrl: post.music.previewUrl, clipStart: post.music.clipStart }
      : undefined,
    reactions: [],
    comments: []
  };
}
