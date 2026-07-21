import { BlurView } from "expo-blur";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Camera, Check, Flame, Home, MapPin, MessageCircle, MoreHorizontal, Users } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { CommentsSheet, type CommentRow } from "@/components/post/CommentsSheet";
import { MediaFrame } from "@/components/post/MediaFrame";
import { ReactionsSheet } from "@/components/post/ReactionsSheet";
import { ContentMenu } from "@/components/ContentMenu";
import { useSheet } from "@/components/ui/Sheet";
import { useDeletePost } from "@/hooks/queries/useContentModeration";
import { MusicChip } from "@/components/post/MusicChip";
import { PostMedia } from "@/components/post/PostMedia";
import { ScenePhoto } from "@/components/post/ScenePhoto";
import { Avatar } from "@/components/ui/Avatar";
import { CtxChip } from "@/components/ui/Chips";
import { Pressable } from "@/components/ui/Pressable";
import { usePostReactionSelfies } from "@/hooks/queries/usePostReactionSelfies";
import { useAddComment, usePostComments } from "@/hooks/queries/usePostComments";
import { useMyReactions, useToggleLike } from "@/hooks/queries/usePostReactions";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { type FeedCtxIcon, type FeedMockPost } from "@/lib/redesignData";
import { showToast, useUiStore } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/** Real Supabase posts carry UUID ids; fixture/demo posts use short slugs. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CTX_ICONS: Record<FeedCtxIcon, typeof MapPin> = { pin: MapPin, users: Users, flame: Flame };

/** "3m" / "5h" / "2d" relative label for a comment timestamp. */
function relTime(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / (60 * 24))}d`;
}

function mono(size: number, color: string, ls = 0) {
  return { fontFamily: "GeistMono_400Regular", fontSize: size, color, letterSpacing: size * ls };
}

type PostCardProps = {
  post: FeedMockPost;
  locked?: boolean;
  /** True while this post is the active one in the viewport — its music auto-plays. */
  audible?: boolean;
  /** Opens the reaction capture sheet for this post. */
  onReact?: (postId: string) => void;
};

/** Feed post card (spec §4.2–4.4). */
export function PostCard({ post, locked = false, audible = false, onReact }: PostCardProps) {
  const sheet = useSheet();
  const deletePost = useDeletePost();
  const isRealPost = UUID_RE.test(post.id);
  const localSelfieUri = useUiStore((state) => state.reactedSelfies[post.id]);
  const reactedLocally = localSelfieUri !== undefined;
  const myProfile = useMyProfile();
  const myName = myProfile.data?.display_name ?? "You";

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

  // Heart like (double-tap) — separate from the selfie reaction rail.
  const myReactions = useMyReactions();
  const toggleLike = useToggleLike();
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
  const realComments: CommentRow[] = (commentsQuery.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    handle: c.handle,
    avatarUrl: c.avatarUrl,
    text: c.text,
    time: relTime(c.createdAt)
  }));
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
  if (renderedPostId !== post.id) {
    setRenderedPostId(post.id);
    setCommentsOpen(false);
    setDraft("");
  }

  const blurRadius = locked ? 14 : undefined;
  const textBlur = locked ? { opacity: 0.55 } : null;

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
    if (isRealPost) {
      addComment.mutate(text, { onError: () => showToast("Couldn't post comment") });
    } else {
      showToast("Comment posted");
    }
  };

  const LocIcon = post.gym ? MapPin : Home;

  const isOwnPost = isRealPost && Boolean(myProfile.data?.username) && myProfile.data?.username === post.user.handle;
  const openMenu = () => {
    sheet.open(
      <ContentMenu
        contentType="post"
        contentId={post.id}
        reportLabel="post"
        reportedUserId={undefined}
        share={{ kind: "post", id: post.id, label: `${post.user.handle}'s post` }}
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

  return (
    // A 16px bg.base gap between posts (no hairline) reads cleaner than an
    // edge-to-edge divider.
    <View style={{ paddingTop: 16, paddingBottom: 16, backgroundColor: tokens.bg.base }}>
      {/* Header row */}
      <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 10 }, textBlur]}>
        <Pressable onPress={openProfile}>
          <Avatar name={post.user.name} uri={post.user.avatarUrl} size={40} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 15, color: tokens.text.primary, letterSpacing: -0.14 }}>
            {post.user.handle}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 }}>
            <LocIcon size={14} color={post.gym ? tokens.text.secondary : tokens.text.tertiary} strokeWidth={2} />
            <Text
              style={{
                fontSize: 13,
                color: post.gym ? tokens.text.secondary : tokens.text.tertiary,
                fontStyle: post.gym ? "normal" : "italic"
              }}
            >
              {post.gym ?? post.altLoc}
            </Text>
          </View>
        </View>
        <Text style={{ fontFamily: "Geist_400Regular", fontSize: 12, color: tokens.text.tertiary }}>{post.time}</Text>
        {isRealPost && !locked ? (
          <Pressable onPress={openMenu} accessibilityLabel="Post options" hitSlop={8} haptic={false} style={{ paddingLeft: 4 }}>
            <MoreHorizontal size={18} color={tokens.text.tertiary} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      {/* Attached song — Instagram-style line under the header; auto-plays
          while this post is the active one in the viewport. */}
      {post.music ? (
        <View style={textBlur}>
          <MusicChip music={post.music} disabled={locked} active={audible && !locked} />
        </View>
      ) : null}

      {/* Media — pinch to zoom, double-tap to like; single taps (video mute)
          route through the same gesture frame so they can't steal the double. */}
      <MediaFrame
        locked={locked}
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
        />
      </MediaFrame>

      {/* Public-feed context chips */}
      {post.ctx?.length ? (
        <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 18, paddingTop: 10 }, textBlur]}>
          {post.ctx.map((chip) => {
            const Icon = CTX_ICONS[chip.icon];
            return (
              <CtxChip key={chip.label} icon={<Icon size={11} color={colors.silver} strokeWidth={2} />}>
                {chip.label}
              </CtxChip>
            );
          })}
        </View>
      ) : null}

      {/* Tagged friends — tappable chips that open each profile */}
      {post.taggedFriends?.length ? (
        <View style={[{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingTop: 10 }, textBlur]}>
          <Users size={12} color={colors.fog} strokeWidth={2} />
          <Text style={{ fontSize: 12.5, color: colors.fog }}>with</Text>
          {post.taggedFriends.map((friend) => (
            <Pressable
              key={friend.handle}
              onPress={() => !locked && router.push(`/user/${friend.handle.replace(/^@/, "")}`)}
              accessibilityLabel={`Open @${friend.handle}'s profile`}
            >
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 12.5, color: colors.white }}>
                @{friend.handle.replace(/^@/, "")}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {/* Caption — larger, more prominent (tester feedback) */}
      {post.caption ? (
        <Text style={[{ fontSize: 15.5, color: colors.bone, lineHeight: 15.5 * 1.4, paddingHorizontal: 18, paddingTop: 11 }, textBlur]}>
          <Text style={{ fontFamily: "Geist_700Bold", color: colors.white }}>{post.user.handle}</Text>
          {"  "}
          {post.caption}
        </Text>
      ) : null}

      {/* Reactions row */}
      <View style={[{ flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 18, paddingTop: 10, paddingBottom: 8 }, textBlur]}>
        <Pressable
          onPress={handleReact}
          accessibilityLabel="Add live reaction"
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            borderWidth: 1.5,
            borderStyle: "dashed",
            borderColor: colors.slate,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {reacted ? (
            <Check size={16} color={colors.silver} strokeWidth={2.2} />
          ) : (
            <Camera size={16} color={colors.silver} strokeWidth={2} />
          )}
        </Pressable>
        {reactorCount > 0 ? (
          <Pressable
            onPress={() => {
              if (serverReactions.length > 0) sheet.open(<ReactionsSheet reactors={serverReactions} postId={post.id} />);
            }}
            accessibilityLabel="See who reacted"
            haptic={false}
            style={{ flexDirection: "row" }}
          >
            {/* Real reactors from the backend (signed selfie or avatar fallback) */}
            {serverReactions.slice(0, 5).map((reactor, index) => (
              <View
                key={reactor.userId}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: reactor.mine ? colors.white : colors.black,
                  marginLeft: index === 0 ? 0 : -9,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {reactor.mediaUrl ? (
                  <Image source={{ uri: reactor.mediaUrl }} contentFit="cover" style={{ width: 34, height: 34 }} />
                ) : (
                  <Avatar name={reactor.name} size={30} borderWidth={0} />
                )}
              </View>
            ))}
            {/* Fixture reactors (demo posts only) */}
            {post.reactions.map((reactor, index) => (
              <View
                key={reactor.name}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: colors.black,
                  marginLeft: index === 0 && serverReactions.length === 0 ? 0 : -9
                }}
              >
                <ScenePhoto scene={reactor.scene} legibility={false} />
              </View>
            ))}
            {/* My just-captured selfie, before the server round-trips */}
            {showLocalPending ? (
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 17,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: colors.white,
                  marginLeft: serverReactions.length || post.reactions.length ? -9 : 0,
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                {localSelfieUri ? (
                  <Image source={{ uri: localSelfieUri }} contentFit="cover" style={{ width: 34, height: 34 }} />
                ) : (
                  <Avatar name={myName} uri={myProfile.data?.avatar_url} size={30} borderWidth={0} />
                )}
              </View>
            ) : null}
          </Pressable>
        ) : null}
        <Text style={mono(11, colors.fog)}>
          {`${reactorCount} live reaction${reactorCount === 1 ? "" : "s"}`}
        </Text>
        <Pressable
          onPress={() => !locked && setCommentsOpen((open) => !open)}
          style={{ flexDirection: "row", alignItems: "center", gap: 5, marginLeft: "auto" }}
          accessibilityLabel="Toggle comments"
        >
          <MessageCircle size={15} color={colors.fog} strokeWidth={2} />
          <Text style={{ fontSize: 12, fontFamily: "Geist_600SemiBold", color: colors.fog }}>{commentCount}</Text>
        </Pressable>
      </View>

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
        loading={commentsQuery.isLoading}
      />

      {/* Locked feed: frost the whole card (names, caption, media) and block taps. */}
      {locked ? (
        <BlurView
          intensity={30}
          tint="dark"
          experimentalBlurMethod="dimezisBlurView"
          style={StyleSheet.absoluteFill}
        />
      ) : null}
    </View>
  );
}
