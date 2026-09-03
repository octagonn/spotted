import { Image } from "expo-image";
import { Camera, Check, Heart, MessageCircle, Send } from "lucide-react-native";
import { View } from "react-native";

import { ScenePhoto } from "@/components/post/ScenePhoto";
import { Avatar } from "@/components/ui/Avatar";
import { CachedImage } from "@/components/ui/CachedImage";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import type { FeedMockPost } from "@/lib/redesignData";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

export type Reactor = { userId: string; name: string; mediaUrl?: string | null; mine?: boolean };

type PostActionsProps = {
  locked?: boolean;
  /** Real (UUID) posts get like/share; fixtures don't. */
  isRealPost: boolean;
  liked: boolean;
  onToggleLike: () => void;
  commentCount: number;
  commentsOpen: boolean;
  onToggleComments: () => void;
  onShare: () => void;
  /** Selfie reaction. */
  reacted: boolean;
  onReact: () => void;
  serverReactions: Reactor[];
  fixtureReactions: FeedMockPost["reactions"];
  /** My just-captured selfie, before the server round-trips. */
  pendingSelfie?: { uri: string | null; name: string; avatarUrl?: string | null } | null;
  reactorCount: number;
  onOpenReactors: () => void;
};

const STACK = 32;
const OVERLAP = -8;

function StackCell({ children, mine = false, first }: { children: React.ReactNode; mine?: boolean; first: boolean }) {
  return (
    <View
      style={{
        width: STACK,
        height: STACK,
        borderRadius: radius.pill,
        overflow: "hidden",
        borderWidth: 2,
        borderColor: mine ? colors.white : colors.black,
        marginLeft: first ? 0 : OVERLAP,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {children}
    </View>
  );
}

/**
 * Action row under the media: like · comments · share · live-reaction capture
 * · reactor stack + count. Icons sit on the standard `md` scale; the count
 * lives in the "Liked by" line so numbers aren't printed twice.
 */
export function PostActions({
  locked = false,
  isRealPost,
  liked,
  onToggleLike,
  commentCount,
  commentsOpen,
  onToggleComments,
  onShare,
  reacted,
  onReact,
  serverReactions,
  fixtureReactions,
  pendingSelfie,
  reactorCount,
  onOpenReactors
}: PostActionsProps) {
  const size = icon.size.md;
  const stroke = icon.stroke.regular;
  const inner = STACK - 4;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[4],
        paddingHorizontal: space[4],
        paddingTop: space[3],
        paddingBottom: 2,
        opacity: locked ? 0.55 : 1
      }}
    >
      {isRealPost ? (
        <Pressable
          onPress={() => !locked && onToggleLike()}
          haptic={liked ? "none" : "impact"}
          accessibilityLabel={liked ? "Unlike" : "Like"}
          accessibilityState={{ selected: liked }}
          hitSlop={8}
        >
          <Heart
            size={size}
            color={liked ? tokens.status.like : colors.silver}
            fill={liked ? tokens.status.like : "transparent"}
            strokeWidth={stroke}
          />
        </Pressable>
      ) : null}
      <Pressable
        onPress={() => !locked && onToggleComments()}
        haptic="none"
        style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}
        accessibilityLabel="Toggle comments"
        accessibilityState={{ expanded: commentsOpen }}
        hitSlop={6}
      >
        <MessageCircle size={size} color={colors.silver} strokeWidth={stroke} />
        <Text variant="meta-strong">{String(commentCount)}</Text>
      </Pressable>
      {isRealPost ? (
        <Pressable onPress={() => !locked && onShare()} haptic="none" accessibilityLabel="Share post" hitSlop={6}>
          <Send size={size - 1} color={colors.silver} strokeWidth={stroke} />
        </Pressable>
      ) : null}
      {/* Live selfie reaction — Spotted's own action; dashed ring marks "capture". */}
      <Pressable
        onPress={onReact}
        haptic={reacted ? "none" : "impact"}
        accessibilityLabel="Add live reaction"
        accessibilityState={{ selected: reacted }}
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.pill,
          borderWidth: 1.5,
          borderStyle: "dashed",
          borderColor: colors.slate,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {reacted ? (
          <Check size={icon.size.xs} color={colors.silver} strokeWidth={icon.stroke.bold} />
        ) : (
          <Camera size={icon.size.xs} color={colors.silver} strokeWidth={stroke} />
        )}
      </Pressable>
      {reactorCount > 0 ? (
        <Pressable
          onPress={onOpenReactors}
          haptic="none"
          accessibilityLabel="See who reacted"
          style={{ flexDirection: "row" }}
        >
          {serverReactions.slice(0, 5).map((reactor, index) => (
            <StackCell key={reactor.userId} mine={reactor.mine} first={index === 0}>
              {reactor.mediaUrl ? (
                <CachedImage
                  source={{ uri: reactor.mediaUrl }}
                  contentFit="cover"
                  style={{ width: STACK, height: STACK }}
                />
              ) : (
                <Avatar name={reactor.name} size={inner} borderWidth={0} />
              )}
            </StackCell>
          ))}
          {fixtureReactions.map((reactor, index) => (
            <StackCell key={reactor.name} first={index === 0 && serverReactions.length === 0}>
              <ScenePhoto scene={reactor.scene} legibility={false} />
            </StackCell>
          ))}
          {pendingSelfie ? (
            <StackCell mine first={serverReactions.length === 0 && fixtureReactions.length === 0}>
              {pendingSelfie.uri ? (
                <Image source={{ uri: pendingSelfie.uri }} contentFit="cover" style={{ width: STACK, height: STACK }} />
              ) : (
                <Avatar name={pendingSelfie.name} uri={pendingSelfie.avatarUrl} size={inner} borderWidth={0} />
              )}
            </StackCell>
          ) : null}
        </Pressable>
      ) : null}
      <Text variant="meta" numberOfLines={1} className="flex-shrink">
        {`${reactorCount} live reaction${reactorCount === 1 ? "" : "s"}`}
      </Text>
    </View>
  );
}
