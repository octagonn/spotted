import { FlashList } from "@shopify/flash-list";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useCommunity, useCommunityMembers, type CommunityMember } from "@/hooks/queries/useCommunities";
import { relDay } from "@/lib/relDay";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";

/** Everyone in a community — tap anyone to open their profile. */
export default function CommunityMembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((state) => state.userId);
  const community = useCommunity(id);
  const members = useCommunityMembers(id);

  const openMember = (member: CommunityMember) => {
    if (!member.profile) return;
    if (member.user_id === userId) router.push("/(tabs)/profile" as Href);
    else router.push(`/user/${member.profile.username}` as Href);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader
        title="Members"
        sub={community.data ? `${community.data.name} · ${community.data.memberCount}` : undefined}
      />
      {members.isLoading ? (
        <SkeletonRows count={5} avatar={44} />
      ) : (
        <FlashList
          data={members.data ?? []}
          keyExtractor={(item: CommunityMember) => item.user_id}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24, paddingTop: 4 }}
          renderItem={({ item }: { item: CommunityMember }) => {
            const name = item.profile?.display_name ?? "Member";
            return (
              <Pressable onPress={() => openMember(item)}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 18 }}>
                  <Avatar name={name} uri={item.profile?.avatar_url ?? null} size={44} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>
                      {name}
                      {item.user_id === userId ? <Text style={{ color: colors.fog }}>  (you)</Text> : null}
                    </Text>
                    <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: colors.fog }}>
                      @{item.profile?.username ?? "unknown"} · joined {relDay(item.joined_at)}
                    </Text>
                  </View>
                  {item.role === "admin" ? (
                    <View style={{ borderWidth: 1, borderColor: colors.gold, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
                      <Text style={{ fontFamily: "Geist_700Bold", fontSize: 10, letterSpacing: 0.5, color: colors.gold }}>ADMIN</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
              No members yet.
            </Text>
          }
        />
      )}
    </View>
  );
}
