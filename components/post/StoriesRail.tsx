import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Lock, Plus } from "lucide-react-native";
import { useEffect } from "react";
import { ScrollView, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useStories, type StoryGroup } from "@/hooks/queries/useStories";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

const AVATAR = 64;
const RING = 2;
const GAP = 2;
// Photo + ring gap + ring stroke, both sides.
const ITEM = AVATAR + 2 * GAP + 2 * RING;

/** Instagram-style story rail at the top of the feed. */
export function StoriesRail() {
  const router = useRouter();
  const stories = useStories();
  const myProfile = useMyProfile();
  const groups = stories.data ?? [];

  const me = groups.find((g) => g.isMe && !g.privateStoryId) ?? null;
  // Everything else — friends' stories AND private-story groups (yours and
  // ones you're a member of) — renders as its own bubble.
  const others = groups.filter((g) => !g.isMe || Boolean(g.privateStoryId));

  // Warm the cache so tapping a ring opens instantly (4a — no blank flash).
  useEffect(() => {
    for (const g of stories.data ?? []) {
      const first = g.stories[0]?.mediaUrl;
      if (first) void Image.prefetch(first);
    }
  }, [stories.data]);
  // Until the profile resolves we don't know the name OR the picture, so show a
  // neutral skeleton instead of the "You" fallback initial (that was the "y"
  // that flashed before the pfp loaded).
  const profileReady = Boolean(myProfile.data);
  const myName = myProfile.data?.display_name ?? me?.name ?? "";
  const myAvatar = me?.avatarUrl ?? myProfile.data?.avatar_url ?? null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: space[3],
        paddingHorizontal: space[4],
        paddingTop: space[2],
        paddingBottom: space[1]
      }}
    >
      {/* Your story — tapping the avatar views your story (or opens the camera
          if you have none); the "+" badge ALWAYS opens the camera so you can add
          another story even after posting one. */}
      <View style={{ width: ITEM, alignItems: "center", gap: space[1] }}>
        <View style={{ width: ITEM, height: ITEM, alignItems: "center", justifyContent: "center" }}>
          <Pressable
            onPress={() => (me ? router.push(`/story?user=${me.userId}`) : router.push("/camera?mode=story"))}
            haptic="none"
            accessibilityLabel={me ? "View your story" : "Add to your story"}
          >
            <Ring active={Boolean(me)} seen={false}>
              {profileReady ? (
                <Avatar name={myName || "?"} uri={myAvatar} size={AVATAR} />
              ) : (
                <View
                  style={{
                    width: AVATAR,
                    height: AVATAR,
                    borderRadius: radius.pill,
                    backgroundColor: tokens.bg.subtle
                  }}
                />
              )}
            </Ring>
          </Pressable>
          <Pressable
            onPress={() => router.push("/camera?mode=story")}
            haptic="impact"
            accessibilityLabel="Add to your story"
            hitSlop={8}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 22,
              height: 22,
              borderRadius: radius.pill,
              backgroundColor: tokens.accent.gold,
              borderWidth: 2,
              borderColor: colors.black,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Plus size={13} color={colors.black} strokeWidth={3} />
          </Pressable>
        </View>
        <Text variant="label" numberOfLines={1} className="text-fog">
          Your story
        </Text>
      </View>

      {others.map((group) => (
        <StoryBubble
          key={`${group.userId}:${group.privateStoryId ?? "main"}`}
          group={group}
          onPress={() =>
            router.push(`/story?user=${group.userId}${group.privateStoryId ? `&ps=${group.privateStoryId}` : ""}`)
          }
        />
      ))}
    </ScrollView>
  );
}

function StoryBubble({ group, onPress }: { group: StoryGroup; onPress: () => void }) {
  const isPrivate = Boolean(group.privateStoryId);
  // Someone ELSE's private story shows the POSTER's name on the rail (the
  // lock badge marks it private); your OWN private lists keep their list
  // names so you can tell them apart.
  const label = isPrivate && group.isMe ? (group.privateStoryName ?? "Private") : group.name.split(" ")[0];
  return (
    <Pressable
      style={{ width: ITEM, alignItems: "center", gap: space[1] }}
      onPress={onPress}
      haptic="none"
      accessibilityLabel={`${group.name}'s ${isPrivate ? "private story" : "story"}, ${group.hasUnseen ? "new" : "seen"}`}
    >
      <View>
        <Ring active seen={group.isMe ? false : !group.hasUnseen}>
          <Avatar name={group.name} uri={group.avatarUrl} size={AVATAR} />
        </Ring>
        {isPrivate ? (
          <View
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: 22,
              height: 22,
              borderRadius: radius.pill,
              backgroundColor: tokens.bg.subtle,
              borderWidth: 2,
              borderColor: colors.black,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Lock size={11} color={colors.white} strokeWidth={icon.stroke.bold} />
          </View>
        ) : null}
      </View>
      <Text variant="label" numberOfLines={1} className={group.hasUnseen && !group.isMe ? "text-white" : "text-fog"}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Story ring: a 2px stroke with a 2px gap between it and the photo. Unviewed →
 * white (a "new" state, not an achievement — gold stays reserved for the add
 * badge, so a rail of five new stories isn't five gold rings); viewed or
 * inactive → border.strong.
 */
function Ring({ active, seen, children }: { active: boolean; seen: boolean; children: React.ReactNode }) {
  return (
    <View
      style={{
        padding: GAP,
        borderWidth: RING,
        borderRadius: radius.pill,
        borderColor: active && !seen ? tokens.text.primary : tokens.border.strong
      }}
    >
      {children}
    </View>
  );
}
