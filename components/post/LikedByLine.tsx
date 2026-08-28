import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import type { PostLiker } from "@/hooks/queries/usePostReactions";
import { summarizeLikers } from "@/lib/likeSummary";
import { colors } from "@/theme/colors";
import { typeScale } from "@/theme/tokens";

/**
 * Instagram's "Liked by <name> and N others" line, sitting between the action
 * row and the caption. Tapping it opens the full likers list.
 *
 * The likers are already in memory — PostCard fetches them for the heart count
 * — so this line costs no extra request, and the sheet it opens reads the same
 * cache key and therefore renders instantly with no loading flash.
 */
export function LikedByLine({
  likers,
  myId,
  myAvatarUrl,
  friendIds,
  onPress
}: {
  likers: readonly PostLiker[];
  myId: string | null;
  /** Your own avatar, for the optimistic row useToggleLike inserts on tap. */
  myAvatarUrl?: string | null;
  friendIds?: ReadonlySet<string>;
  onPress?: () => void;
}) {
  const summary = summarizeLikers(likers, myId, friendIds);
  if (!summary) return null;

  // Faces lead the line the way Instagram does. Avatars are decorative here —
  // the text carries the meaning — so they stay out of the a11y tree.
  const faces = likers.slice(0, 3);
  const strong = { ...typeScale.meta, fontFamily: "Geist_600SemiBold", color: colors.white } as const;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityLabel={`${summary.label}. See everyone who liked this post.`}
      accessibilityRole="button"
      haptic={false}
      hitSlop={6}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 6
        }}
      >
        {faces.length ? (
          <View style={{ flexDirection: "row" }} importantForAccessibility="no-hide-descendants">
            {faces.map((face, index) => {
              // The optimistic like row carries no avatar, so your own face
              // would pop from a placeholder to your photo a moment later.
              const mine = Boolean(myId) && face.userId === myId;
              return (
                <View key={face.userId} style={{ marginLeft: index === 0 ? 0 : -7 }}>
                  <Avatar
                    name={face.displayName}
                    uri={mine ? face.avatarUrl ?? myAvatarUrl ?? null : face.avatarUrl}
                    size={20}
                    borderWidth={1.5}
                    borderColor={colors.black}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
        <Text style={{ ...typeScale.meta, color: colors.fog, flexShrink: 1 }} numberOfLines={1}>
          Liked by <Text style={strong}>{summary.lead}</Text>
          {summary.second ? (
            <>
              {" and "}
              <Text style={strong}>{summary.second}</Text>
            </>
          ) : summary.others ? (
            <>
              {" and "}
              <Text style={strong}>{`${summary.others} others`}</Text>
            </>
          ) : null}
        </Text>
      </View>
    </Pressable>
  );
}
