import { BlurView } from "expo-blur";
import { router } from "expo-router";
import { Flame, Volume2, VolumeX } from "lucide-react-native";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { CommentsSheet, type CommentRow, type ReplyTarget } from "@/components/post/CommentsSheet";
import { LikedByLine } from "@/components/post/LikedByLine";
import { LikersSheet } from "@/components/post/LikersSheet";
import { MediaFrame } from "@/components/post/MediaFrame";
import { MusicChip } from "@/components/post/MusicChip";
import { PostActions } from "@/components/post/PostActions";
import { PostCaption } from "@/components/post/PostCaption";
import { PostHeader } from "@/components/post/PostHeader";
import { PostMedia } from "@/components/post/PostMedia";
import { ReactionsSheet } from "@/components/post/ReactionsSheet";
import { ContentMenu } from "@/components/ContentMenu";
import { ShareToFriendSheet } from "@/components/friends/ShareToFriendSheet";
import { Pressable } from "@/components/ui/Pressable";
import { useSheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useDeletePost } from "@/hooks/queries/useContentModeration";
import { useFriends } from "@/hooks/queries/useFriends";
import { useAddComment, useDeleteComment, usePostComments } from "@/hooks/queries/usePostComments";
import { usePostLikers, useMyReactions, useToggleLike } from "@/hooks/queries/usePostReactions";
import { usePostReactionSelfies } from "@/hooks/queries/usePostReactionSelfies";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useRepostToStory } from "@/hooks/queries/useStories";
import { type FeedMockPost } from "@/lib/redesignData";
import { useAudioStore } from "@/stores/audio";
import { showToast, useUiStore } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/** Real Supabase posts carry UUID ids; fixture/demo posts use short slugs. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "3m" / "5h" / "2d" relative label for a comment timestamp. */
function relTime(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (60 * 24))}d`;
}

type PostCardProps = {
  post: FeedMockPost;
  locked?: boolean;
  /** True while this post is the active one in the viewport — its music auto-plays. */
  audible?: boolean;
  /** Opens the reaction capture sheet for this post. */
  onReact?: (postId: string) => void;
  /** Full-screen pinch preview (root overlay). Turn OFF inside native modals
   *  (post/[id]) — they render above the root host, so the overlay would be
   *  invisible there; those fall back to the in-place zoom. */
  zoomPreview?: boolean;
};

/** Speaker control that sits on the media, over a scrim. */
function MuteButton({
  muted,
  onPress,
  side,
  label
}: {
  muted: boolean;
  onPress: () => void;
  side: "left" | "right";
  label: string;
}) {
  const Icon = muted ? VolumeX : Volume2;
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      accessibilityState={{ selected: muted }}
      hitSlop={8}
      haptic="none"
      style={{
        position: "absolute",
        bottom: space[3],
        [side]: space[3],
        width: 30,
        height: 30,
        borderRadius: radius.pill,
        backgroundColor: tokens.bg.scrim,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Icon size={15} color={colors.white} strokeWidth={icon.stroke.bold} />
    </Pressable>
  );
}

/**
 * Feed post card. Orchestrates data + sheets for one post and composes
 * PostHeader → MusicChip → media → PostActions → LikedByLine → PostCaption.
 * Media is the hero; every other block is a single spacing step around it.
 */
function PostCardInner({ post, locked = false, audible = false, onReact, zoomPreview = true }: PostCardProps) {
  const sheet = useSheet();
  const deletePost = useDeletePost();
  const isRealPost = UUID_RE.test(post.id);
  const localSelfieUri = useUiStore((state) => state.reactedSelfies[post.id]);
  const reactedLocally = localSelfieUri !== undefined;
  const myProfile = useMyProfile();
  const myName = myProfile.data?.display_name ?? "You";
  const myId = myProfile.data?.id ?? null;
  // Shared react-query cache, so this is one request for the whole feed rather
  // than one per card. It decides WHICH liker's name leads the "Liked by" line
  // — a name you recognise is the only reason that line is worth reading.
  const friends = useFriends();
  const friendIds = useMemo(() => new Set((friends.data ?? []).map((friend) => friend.id)), [friends.data]);

  // Real reactions from the backend — this is what surfaces a friend's reaction
  // on your feed. Only queried for real posts (fixtures have no rows).
  const reactionQuery = usePostReactionSelfies(isRealPost ? post.id : "");
  const serverReactions = isRealPost ? (reactionQuery.data ?? []) : [];
  const iReactedOnServer = serverReactions.some((r) => r.mine);
  // Show my just-captured selfie immediately, until the server list includes it.
  const showLocalPending = reactedLocally && !iReactedOnServer;
  const reactorCount = serverReactions.length + (showLocalPending ? 1 : 0) + post.reactions.length;
  const reacted = reactedLocally || iReactedOnServer;
  const [renderedPostId, setRenderedPostId] = useState(post.id);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState("");

  // Heart like (double-tap or the heart button) — separate from the selfie
  // reaction rail.
  const myReactions = useMyReactions();
  const toggleLike = useToggleLike();
  const repostToStory = useRepostToStory();
  // Who liked this post — drives the "Liked by …" line and the Likes sheet,
  // which share this cache entry. Optimistically patched by useToggleLike so
  // the line updates the instant you tap the heart.
  const likersQuery = usePostLikers(isRealPost ? post.id : "");
  // Global feed audio switch — drives the IG-style speaker on musical posts.
  const audioMuted = useAudioStore((st) => st.muted);
  const toggleAudioMuted = useAudioStore((st) => st.toggleMuted);
  const liked = isRealPost && (myReactions.data ?? []).includes(post.id);

  // Video mute (single tap) registered by the media so it routes through
  // MediaFrame's gesture instead of a Pressable that would eat double-taps.
  const mediaTapRef = useRef<(() => void) | null>(null);
  const registerMediaTap = useCallback((handler: (() => void) | null) => {
    mediaTapRef.current = handler;
  }, []);

  // Real comments for real posts; fixtures fall back to their seeded list.
  const commentsQuery = usePostComments(post.id, isRealPost && commentsOpen);
  const addComment = useAddComment(post.id);
  const deleteComment = useDeleteComment(post.id);
  const realComments: CommentRow[] = (commentsQuery.data ?? []).map((c) => ({
    id: c.id,
    userId: c.userId,
    name: c.name,
    handle: c.handle,
    avatarUrl: c.avatarUrl,
    text: c.text,
    time: relTime(c.createdAt),
    parentId: c.parentId
  }));
  const [commentReplyTo, setCommentReplyTo] = useState<ReplyTarget | null>(null);
  // Dual posts: which photo is currently the big one (tap the inset to swap).
  // Lifted here so the pinch-zoom preview mirrors the visible main photo.
  const [swapped, setSwapped] = useState(false);
  const fixtureComments: CommentRow[] = post.comments.map((c, i) => ({
    id: `f-${i}`,
    name: c.name ?? c.handle,
    handle: c.handle,
    text: c.text,
    time: c.time
  }));
  const comments = isRealPost ? realComments : fixtureComments;
  const commentCount = isRealPost ? comments.length : post.comments.length;

  // Render-phase reset when FlashList hands this instance a different post.
  // Must clear commentReplyTo too — otherwise a "replying to …" target from the
  // previous post leaks onto this one, and a new comment is threaded under a
  // parent comment id that belongs to a different post.
  if (renderedPostId !== post.id) {
    setRenderedPostId(post.id);
    setCommentsOpen(false);
    setDraft("");
    setCommentReplyTo(null);
    setSwapped(false);
  }

  const blurRadius = locked ? 14 : undefined;
  // IG-style full-screen pinch preview — plain photo posts only; videos,
  // carousels, plates, and workout stacks keep the in-place zoom.
  const isPlainPhoto =
    !post.video &&
    !(post.workouts?.length ?? 0) &&
    (post.mediaUris?.length ?? 0) <= 1 &&
    post.kind !== "pr" &&
    post.kind !== "streak" &&
    post.kind !== "video" &&
    post.kind !== "compare";
  const zoomUri =
    isPlainPhoto && zoomPreview ? (swapped && post.insetUri ? post.insetUri : post.mediaUri) || null : null;

  const openProfile = () => {
    if (!locked) {
      router.push(`/user/${post.user.handle}`);
    }
  };

  const handleReact = () => {
    if (locked) {
      showToast("Post today to react");
      return;
    }
    if (reacted) {
      showToast("Reaction already added");
      return;
    }
    onReact?.(post.id);
  };

  const postComment = () => {
    const text = draft.trim();
    if (!text) {
      return;
    }
    setDraft("");
    const parentId = commentReplyTo?.id ?? null;
    setCommentReplyTo(null);
    if (isRealPost) {
      addComment.mutate({ text, parentId }, { onError: () => showToast("Couldn't post comment") });
    } else {
      showToast("Comment posted");
    }
  };

  const isOwnPost = isRealPost && Boolean(myProfile.data?.username) && myProfile.data?.username === post.user.handle;
  // Tagged in this post (caption tags or on-photo tags) → the ⋯ menu offers
  // "Add to your story" (IG-style reshare; the RPC re-checks the tag).
  const myHandle = myProfile.data?.username ?? null;
  const taggedInPost =
    isRealPost &&
    !isOwnPost &&
    Boolean(myHandle) &&
    (Boolean(post.taggedFriends?.some((friend) => friend.handle.replace(/^@/, "") === myHandle)) ||
      Boolean(post.photoTags?.some((tag) => tag.username === myHandle)));
  const openMenu = () => {
    sheet.open(
      <ContentMenu
        contentType="post"
        contentId={post.id}
        reportLabel="post"
        reportedUserId={post.authorId ?? undefined}
        onAddToStory={
          taggedInPost && post.kind !== "video" && !post.video
            ? () =>
                repostToStory.mutate(post.id, {
                  onSuccess: () => showToast("Added to your story"),
                  onError: (error) => {
                    const message = error instanceof Error ? error.message : "";
                    showToast(
                      message.includes("already_reposted") ? "Already on your story" : "Couldn't add to your story"
                    );
                  }
                })
            : undefined
        }
        onDelete={
          isOwnPost
            ? () =>
                deletePost.mutate(
                  { postId: post.id, mediaPaths: [] },
                  {
                    onSuccess: () => showToast("Post deleted"),
                    onError: () => showToast("Couldn't delete — try again")
                  }
                )
            : undefined
        }
      />
    );
  };

  const dim = { opacity: locked ? 0.55 : 1 };

  return (
    // 16 + 16 of base background between posts (no hairline) — 32pt separation.
    <View style={{ paddingTop: space[4], paddingBottom: space[4], backgroundColor: tokens.bg.base }}>
      <PostHeader
        user={post.user}
        gym={post.gym}
        altLoc={post.altLoc}
        time={post.time}
        locked={locked}
        onOpenProfile={openProfile}
        onOpenMenu={isRealPost && !locked ? openMenu : undefined}
      />

      {/* Attached song — secondary line under the header; auto-plays while
          this post is the active one in the viewport. */}
      {post.music ? (
        <View style={dim}>
          <MusicChip music={post.music} disabled={locked} active={audible && !locked} />
        </View>
      ) : null}

      {/* Owner-only: this post is hidden from others pending moderation review. */}
      {post.underReview ? (
        <View
          style={{
            marginHorizontal: space[4],
            marginBottom: space[3],
            flexDirection: "row",
            alignItems: "center",
            gap: space[2],
            paddingVertical: space[2],
            paddingHorizontal: space[3],
            borderRadius: radius.sm,
            backgroundColor: tokens.accent.goldSubtle
          }}
        >
          <Flame size={14} color={tokens.accent.gold} strokeWidth={icon.stroke.bold} />
          <Text variant="label" className="flex-1">
            Under review — hidden from others until it&apos;s checked.
          </Text>
        </View>
      ) : null}

      {/* Media — pinch to zoom, double-tap to like; single taps (video mute)
          route through the same gesture frame so they can't steal the double. */}
      <View>
        <MediaFrame
          locked={locked}
          zoomUri={zoomUri}
          onLike={() => {
            if (isRealPost && !liked) {
              toggleLike.mutate({ postId: post.id, liked: true });
            }
          }}
          onSingleTap={() => mediaTapRef.current?.()}
        >
          <PostMedia
            post={post}
            blurRadius={blurRadius}
            active={audible && !locked}
            onRegisterTap={registerMediaTap}
            swapped={swapped}
            onToggleSwap={() => setSwapped((s) => !s)}
          />
        </MediaFrame>
        {/* Speaker, bottom-right — only on posts with attached music. */}
        {post.music?.previewUrl && !post.video && !locked ? (
          <MuteButton
            muted={audioMuted}
            onPress={toggleAudioMuted}
            side="right"
            label={audioMuted ? "Unmute sound" : "Mute sound"}
          />
        ) : null}
        {/* Video posts autoplay muted with tap-to-mute; this is the accessible,
            discoverable control (bottom-left so it clears the duration clock). */}
        {post.video && !locked ? (
          <MuteButton
            muted={audioMuted}
            onPress={toggleAudioMuted}
            side="left"
            label={audioMuted ? "Unmute" : "Mute"}
          />
        ) : null}
      </View>

      <PostActions
        locked={locked}
        isRealPost={isRealPost}
        liked={liked}
        onToggleLike={() => toggleLike.mutate({ postId: post.id, liked: !liked })}
        commentCount={commentCount}
        commentsOpen={commentsOpen}
        onToggleComments={() => setCommentsOpen((open) => !open)}
        onShare={() =>
          sheet.open(<ShareToFriendSheet sharedKind="post" sharedId={post.id} label={`${post.user.handle}'s post`} />)
        }
        reacted={reacted}
        onReact={handleReact}
        serverReactions={serverReactions}
        fixtureReactions={post.reactions}
        pendingSelfie={
          showLocalPending ? { uri: localSelfieUri ?? null, name: myName, avatarUrl: myProfile.data?.avatar_url } : null
        }
        reactorCount={reactorCount}
        onOpenReactors={() => {
          if (serverReactions.length > 0) sheet.open(<ReactionsSheet reactors={serverReactions} postId={post.id} />);
        }}
      />

      {/* "Liked by <name> and N others" — between the actions and the caption. */}
      {isRealPost ? (
        <View style={dim}>
          <LikedByLine
            likers={likersQuery.data ?? []}
            myId={myId}
            myAvatarUrl={myProfile.data?.avatar_url ?? null}
            friendIds={friendIds}
            onPress={locked ? undefined : () => sheet.open(<LikersSheet postId={post.id} />)}
          />
        </View>
      ) : null}

      <PostCaption post={post} locked={locked} />

      {/* Comments open in a keyboard-avoiding bottom sheet so the input stays visible. */}
      <CommentsSheet
        visible={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        comments={comments}
        myName={myName}
        myAvatarUri={myProfile.data?.avatar_url ?? null}
        draft={draft}
        onChangeDraft={setDraft}
        onSubmit={postComment}
        replyTo={commentReplyTo}
        onReply={isRealPost ? setCommentReplyTo : undefined}
        myUserId={myProfile.data?.id ?? null}
        canModerate={isOwnPost}
        onDelete={
          isRealPost
            ? (id) => deleteComment.mutate(id, { onError: () => showToast("Couldn't delete — try again") })
            : undefined
        }
        loading={commentsQuery.isLoading}
      />

      {/* Locked feed: frost the whole card (names, caption, media) and block taps. */}
      {locked ? (
        <BlurView intensity={30} tint="dark" experimentalBlurMethod="dimezisBlurView" style={StyleSheet.absoluteFill} />
      ) : null}
    </View>
  );
}

/**
 * Memoized: the feed re-renders on every viewability change (active post), so
 * without this every visible card re-rendered on scroll. Only the card whose
 * `audible`/`locked`/`post` actually changed re-renders now.
 */
export const PostCard = memo(PostCardInner);
