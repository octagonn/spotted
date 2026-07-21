import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useStories, type StoryGroup } from "@/hooks/queries/useStories";
import { colors } from "@/theme/colors";

/** Instagram-style story rail at the top of the feed. */
export function StoriesRail() {
  const router = useRouter();
  const stories = useStories();
  const myProfile = useMyProfile();
  const groups = stories.data ?? [];

  const me = groups.find((g) => g.isMe) ?? null;
  const others = groups.filter((g) => !g.isMe);
  // Always show the signed-in user's real avatar on "Your story", even with no
  // active story — falling back to initials only when there's genuinely no pic.
  const myName = myProfile.data?.display_name ?? me?.name ?? "You";
  const myAvatar = me?.avatarUrl ?? myProfile.data?.avatar_url ?? null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 14, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 6 }}
    >
      {/* Your story / add-story bubble */}
      <Pressable
        style={{ width: 62, alignItems: "center", gap: 4 }}
        onPress={() =>
          me ? router.push(`/story?user=${me.userId}`) : router.push("/camera?mode=story")
        }
      >
        <View style={{ width: 62, height: 62, alignItems: "center", justifyContent: "center" }}>
          <Ring active={Boolean(me)} seen={false}>
            <Avatar name={myName} uri={myAvatar} size={52} />
          </Ring>
          <View
            style={{
              position: "absolute",
              right: 2,
              bottom: 0,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: colors.white,
              borderWidth: 2,
              borderColor: colors.black,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Plus size={12} color={colors.black} strokeWidth={3} />
          </View>
        </View>
        <Text numberOfLines={1} style={{ fontSize: 10, color: colors.mist, maxWidth: 62 }}>
          Your story
        </Text>
      </Pressable>

      {others.map((group) => (
        <StoryBubble key={group.userId} group={group} onPress={() => router.push(`/story?user=${group.userId}`)} />
      ))}
    </ScrollView>
  );
}

function StoryBubble({ group, onPress }: { group: StoryGroup; onPress: () => void }) {
  return (
    <Pressable style={{ width: 62, alignItems: "center", gap: 4 }} onPress={onPress}>
      <Ring active seen={!group.hasUnseen}>
        <Avatar name={group.name} uri={group.avatarUrl} size={52} />
      </Ring>
      <Text
        numberOfLines={1}
        style={{ fontSize: 10, color: group.hasUnseen ? colors.mist : colors.fog, maxWidth: 62 }}
      >
        {group.name.split(" ")[0]}
      </Text>
    </Pressable>
  );
}

/** Story ring: bright white when there's an unseen story, dim when all seen. */
function Ring({ active, seen, children }: { active: boolean; seen: boolean; children: React.ReactNode }) {
  return (
    <View
      style={{
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: active ? 2 : 1.5,
        borderColor: !active ? colors.iron : seen ? colors.slate : colors.white,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {children}
    </View>
  );
}
