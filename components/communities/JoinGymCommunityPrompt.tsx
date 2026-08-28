import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useRouter, type Href } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useCommunityMembers, useJoinGymCommunity, useMyCommunities } from "@/hooks/queries/useCommunities";
import { useFriends } from "@/hooks/queries/useFriends";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { usePresenceStore } from "@/stores/presence";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/tokens";

/** Spec: at most once per week per gym per user if dismissed. */
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const promptKey = (userId: string, gymId: string) => `gym-join-prompt:${userId}:${gymId}`;

type GymCommunity = { id: string; name: string; memberCount: number };

/** The gym's community, if one exists. Never created here (spec: no auto-generated groups). */
function useGymCommunity(gymId: string | null) {
  return useQuery({
    queryKey: ["gym-community", gymId],
    enabled: isSupabaseConfigured && Boolean(gymId),
    staleTime: 60_000,
    queryFn: async (): Promise<GymCommunity | null> => {
      const { data, error } = await supabase
        .from("communities")
        .select("id, name, members:community_members(count)")
        .eq("gym_id", gymId as string)
        .eq("type", "gym")
        .maybeSingle();
      if (error) throw error;
      const row = data as unknown as { id: string; name: string; members?: { count: number }[] } | null;
      return row ? { id: row.id, name: row.name, memberCount: row.members?.[0]?.count ?? 0 } : null;
    }
  });
}

/**
 * Opt-in prompt after a check-in at a gym that has a community you haven't
 * joined. Never auto-adds (location-based membership is a bigger exposure
 * than friends-only defaults); shown at most once a week per gym if dismissed.
 */
export function JoinGymCommunityPrompt({ userId }: { userId: string | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const atGym = usePresenceStore((s) => s.atGym);
  const activeGymId = usePresenceStore((s) => s.activeGymId);
  const gymId = atGym ? activeGymId : null;

  const community = useGymCommunity(gymId);
  const mine = useMyCommunities();
  const isMember = Boolean(community.data && (mine.data ?? []).some((c) => c.id === community.data?.id));
  const members = useCommunityMembers(community.data?.id, Boolean(community.data) && !isMember && mine.isSuccess);
  const friends = useFriends();
  const join = useJoinGymCommunity();

  const [visible, setVisible] = useState(false);
  const [shownFor, setShownFor] = useState<string | null>(null);

  // Friends you've checked in with who are already in the group.
  const mutuals = useMemo(() => {
    const friendIds = new Set((friends.data ?? []).map((f) => f.id));
    return (members.data ?? []).filter((m) => friendIds.has(m.user_id)).slice(0, 3);
  }, [friends.data, members.data]);

  useEffect(() => {
    if (!userId || !gymId || !community.data || !mine.isSuccess || isMember) return;
    if (shownFor === gymId) return;
    let cancelled = false;
    void AsyncStorage.getItem(promptKey(userId, gymId))
      .then((last) => {
        if (cancelled) return;
        if (last && Date.now() - Number(last) < PROMPT_COOLDOWN_MS) return;
        setShownFor(gymId);
        setVisible(true);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId, gymId, community.data, mine.isSuccess, isMember, shownFor]);

  const dismiss = () => {
    setVisible(false);
    if (userId && gymId) void AsyncStorage.setItem(promptKey(userId, gymId), String(Date.now())).catch(() => undefined);
  };

  const accept = () => {
    if (!gymId || !community.data) return;
    const name = community.data.name;
    setVisible(false);
    join.mutate(gymId, {
      onSuccess: (communityId) => {
        showToast(`Joined ${name}`);
        router.push(`/community/${communityId}?tab=Chat` as Href);
      },
      onError: () => showToast("Couldn't join — try again from the Gyms tab")
    });
  };

  if (!community.data) return null;
  const name = community.data.name;
  const count = community.data.memberCount;
  const title =
    mutuals.length > 0
      ? `${mutuals.length} ${mutuals.length === 1 ? "person" : "people"} you've checked in with ${mutuals.length === 1 ? "is" : "are"} in the ${name} group`
      : `${count} ${count === 1 ? "member checks" : "members check"} in at ${name}. Join the group?`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismiss} statusBarTranslucent>
      <View accessibilityViewIsModal style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.68)" }}>
        <View
          style={{
            backgroundColor: colors.ink,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.iron,
            paddingHorizontal: 24,
            paddingTop: 22,
            paddingBottom: insets.bottom + 20
          }}
        >
          <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.slate, alignSelf: "center", marginBottom: 16 }} />
          {mutuals.length > 0 ? (
            <View style={{ flexDirection: "row", marginBottom: 12 }}>
              {mutuals.map((m, i) => (
                <View key={m.user_id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                  <Avatar name={m.profile?.display_name ?? "Member"} uri={m.profile?.avatar_url ?? null} size={34} borderColor={colors.ink} borderWidth={2} />
                </View>
              ))}
            </View>
          ) : null}
          <Text accessibilityRole="header" style={{ fontFamily: "Geist_700Bold", fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: colors.white }}>
            {title}
          </Text>
          <Text style={{ marginTop: 8, fontSize: 13.5, lineHeight: 20, color: colors.silver }}>
            Group chat, a board that only counts this gym, and a feed of everyone who trains here.
            {mutuals.length > 0 ? ` ${count} ${count === 1 ? "member" : "members"}.` : ""}
          </Text>
          <View style={{ marginTop: 18, gap: 9 }}>
            <Button onPress={accept} loading={join.isPending} disabled={join.isPending}>
              Join the group
            </Button>
            <Button variant="ghost" onPress={dismiss} disabled={join.isPending}>
              Not now
            </Button>
          </View>
          <Text style={{ marginTop: 12, fontSize: 11.5, lineHeight: 17, color: colors.fog }}>
            Joining puts you on this gym&apos;s board and member list. Leave any time from Members — one tap. We won&apos;t ask again this week.
          </Text>
        </View>
      </View>
    </Modal>
  );
}
