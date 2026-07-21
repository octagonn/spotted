import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { useEffect } from "react";
import { ScrollView, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useStories, type StoryGroup } from "@/hooks/queries/useStories";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

const AVATAR = 79;
// Photo (79) + 3px gap (ring padding) + 3px ring stroke, both sides.
const ITEM = AVATAR + 2 * 3 + 2 * 3;

/** Instagram-style story rail at the top of the feed. */
export function StoriesRail() {
  const router = useRouter();
  const stories = useStories();
  const myProfile = useMyProfile();
  const groups = stories.data ?? [];

  const me = groups.find((g) => g.isMe) ?? null;
  const others = groups.filter((g) => !g.isMe);

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
      contentContainerStyle={{ gap: 16, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 6 }}
    >
      {/* Your story — tapping the avatar views your story (or opens the camera
          if you have none); the "+" badge ALWAYS opens the camera so you can add
          another story even after posting one. */}
      <View style={{ width: ITEM, alignItems: "center", gap: 6 }}>
        <View style={{ width: ITEM, height: ITEM, alignItems: "center", justifyContent: "center" }}>
          <Pressable
            onPress={() => (me ? router.push(`/story?user=${me.userId}`) : router.push("/camera?mode=story"))}
            accessibilityLabel={me ? "View your story" : "Add to your story"}
          >
            <Ring active={Boolean(me)} seen={false}>
              {profileReady ? (
                <Avatar name={myName || "?"} uri={myAvatar} size={AVATAR} />
              ) : (
                <View style={{ width: AVATAR, height: AVATAR, borderRadius: radius.pill, backgroundColor: tokens.bg.subtle }} />
              )}
            </Ring>
          </Pressable>
          <Pressable
            onPress={() => router.push("/camera?mode=story")}
            accessibilityLabel="Add to your story"
            hitSlop={8}
            style={{
              position: "absolute",
              right: 2,
              bottom: 2,
              width: 26,
              height: 26,
              borderRadius: radius.pill,
              backgroundColor: tokens.accent.gold,
              borderWidth: 2,
              borderColor: tokens.bg.base,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Plus size={15} color={colors.black} strokeWidth={3} />
          </Pressable>
        </View>
        <Text numberOfLines={1} style={{ fontFamily: "Geist_400Regular", fontSize: 13, color: tokens.text.secondary, maxWidth: ITEM }}>
          Your story
        </Text>
      </View>

      {others.map((group) => (
        <StoryBubble key={group.userId} group={group} onPress={() => router.push(`/story?user=${group.userId}`)} />
      ))}
    </ScrollView>
  );
}

function StoryBubble({ group, onPress }: { group: StoryGroup; onPress: () => void }) {
  return (
    <Pressable style={{ width: ITEM, alignItems: "center", gap: 6 }} onPress={onPress}>
      <Ring active seen={!group.hasUnseen}>
        <Avatar name={group.name} uri={group.avatarUrl} size={AVATAR} />
      </Ring>
      <Text
        numberOfLines={1}
        style={{ fontFamily: "Geist_400Regular", fontSize: 13, color: tokens.text.secondary, maxWidth: ITEM }}
      >
        {group.name.split(" ")[0]}
      </Text>
    </Pressable>
  );
}

/**
 * Story ring: a 3px stroke with a 3px transparent gap (ring padding) between it
 * and the photo. Unviewed → gold; viewed or inactive → border.strong.
 */
function Ring({ active, seen, children }: { active: boolean; seen: boolean; children: React.ReactNode }) {
  return (
    <View
      style={{
        padding: 3,
        borderWidth: 3,
        borderRadius: radius.pill,
        borderColor: active && !seen ? tokens.accent.gold : tokens.border.strong
      }}
    >
      {children}
    </View>
  );
}
