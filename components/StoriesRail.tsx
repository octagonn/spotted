import { Plus } from "lucide-react-native";
import { ScrollView, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import type { FeedPost, Profile } from "@/types/domain";

type StoriesRailProps = {
  posts: FeedPost[];
  me?: Pick<Profile, "id" | "username" | "display_name" | "avatar_url"> | null;
  hasPostedToday?: boolean;
  onOpenPost: (postId: string) => void;
  onOpenCamera: () => void;
};

function StoryItem({
  uri,
  label,
  ringTone,
  badge,
  onPress
}: {
  uri?: string | null;
  label: string;
  ringTone: "active" | "viewed" | "self";
  badge?: "plus" | null;
  onPress: () => void;
}) {
  const ringColor =
    ringTone === "active" ? "#FAFAFA" : ringTone === "self" ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.18)";
  return (
    <Pressable className="mr-3 items-center" onPress={onPress} pressedClassName="opacity-80" haptic={false}>
      <View
        style={{
          width: 68,
          height: 68,
          borderRadius: 999,
          padding: 2.5,
          borderWidth: ringTone === "active" ? 2 : 1.2,
          borderColor: ringColor,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: 60, height: 60, borderRadius: 999, overflow: "hidden", backgroundColor: colors.graphite }}>
          <Avatar uri={uri ?? undefined} size="md" rounded="circle" />
        </View>
        {badge === "plus" ? (
          <View
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              height: 22,
              width: 22,
              borderRadius: 999,
              borderWidth: 2,
              borderColor: "#000000",
              backgroundColor: "#FAFAFA",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Plus color="#000000" size={12} strokeWidth={3} />
          </View>
        ) : null}
      </View>
      <Text
        variant="micro"
        numberOfLines={1}
        className={`mt-2 max-w-[68px] ${ringTone === "viewed" ? "text-fog" : "text-mist"}`}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );
}

export function StoriesRail({ posts, me, hasPostedToday, onOpenPost, onOpenCamera }: StoriesRailProps) {
  const sorted = [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return (
    <View className="border-b border-hairline pb-4">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 12 }}
      >
        <StoryItem
          uri={me?.avatar_url}
          label="YOU"
          ringTone={hasPostedToday ? "self" : "self"}
          badge={hasPostedToday ? null : "plus"}
          onPress={onOpenCamera}
        />
        {sorted.map((post) => (
          <StoryItem
            key={post.id}
            uri={post.profile.avatar_url}
            label={post.profile.username}
            ringTone="active"
            onPress={() => onOpenPost(post.id)}
          />
        ))}
      </ScrollView>
    </View>
  );
}
