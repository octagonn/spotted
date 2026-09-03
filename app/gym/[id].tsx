import { useLocalSearchParams } from "expo-router";
import { useRouter, type Href } from "expo-router";
import { MapPin, Users } from "lucide-react-native";
import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GymLogo } from "@/components/GymLogo";
import { GymFallbackIcon } from "@/components/map/GymRow";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { UserRow } from "@/components/ui/UserRow";
import { useGym, useGymPresence } from "@/hooks/queries/useGymPresence";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useSetHomeGym } from "@/hooks/queries/useProfileExtras";
import { fixGymPin, type FixGymPinResult } from "@/lib/location";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, space, tokens } from "@/theme/tokens";

/**
 * Gym page: identity, who's checked in now (gym-level presence — never a
 * user's coordinates), and the home-gym action.
 */
export default function GymDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const presence = useGymPresence();
  const gymQuery = useGym(params.id);
  const gym = gymQuery.data;
  const me = useMyProfile();
  const setHomeGym = useSetHomeGym();
  const isHome = Boolean(gym && me.data?.gym?.id === gym.id);
  const friends = presence.data?.presence.filter((item) => item.gym.id === gym?.id) ?? [];

  const [fixingPin, setFixingPin] = useState(false);
  const runFixPin = async () => {
    if (!gym || fixingPin) return;
    setFixingPin(true);
    try {
      const result = await fixGymPin(gym.id);
      const messages: Record<FixGymPinResult, string> = {
        fixed: "Pin moved to your location — check-ins will work here now",
        already_accurate: "The pin already matches where you are",
        too_far_from_gym: "You need to be at the gym to fix its pin",
        gps_too_coarse: "GPS is too fuzzy right now — try again near a window or outside",
        rate_limited: "This pin was fixed recently — try again tomorrow",
        no_location: "Spotted needs location access to fix the pin",
        error: "Couldn't fix the pin — try again"
      };
      showToast(messages[result]);
      if (result === "fixed") {
        void gymQuery.refetch();
      }
    } finally {
      setFixingPin(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title={gym?.name ?? "Gym"} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[3],
            paddingHorizontal: space[4],
            paddingTop: space[2]
          }}
        >
          {gym ? (
            <GymLogo gym={gym} size={56} fallback={<GymFallbackIcon size={56} />} />
          ) : (
            <GymFallbackIcon size={56} />
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="heading" numberOfLines={2}>
              {gym?.name ?? "Gym"}
            </Text>
            {gym?.address ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginTop: 2 }}>
                <MapPin size={12} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
                <Text variant="meta" numberOfLines={2} className="flex-shrink">
                  {gym.address}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <SectionLabel style={{ paddingHorizontal: space[4], paddingTop: space[6], paddingBottom: space[1] }}>
          Here now
        </SectionLabel>
        {presence.isLoading ? (
          <SkeletonRows count={3} />
        ) : friends.length ? (
          friends.map((friend) => (
            <UserRow
              key={friend.id}
              name={friend.profile.display_name}
              avatarUrl={friend.profile.avatar_url}
              sub={`@${friend.profile.username}`}
              onPress={
                friend.profile.username ? () => router.push(`/user/${friend.profile.username}` as Href) : undefined
              }
            />
          ))
        ) : (
          <EmptyState
            icon={<Users size={icon.size.md} color={tokens.text.tertiary} strokeWidth={icon.stroke.thin} />}
            title="No friends here right now"
            body="Friends who check in show up here while they're at the gym."
            center
            paddingTop={space[4]}
          />
        )}

        {gym ? (
          <View style={{ paddingHorizontal: space[4], paddingTop: space[6], gap: space[2] }}>
            {isHome ? (
              <Button variant="ghost" disabled>
                Your home gym
              </Button>
            ) : (
              <Button
                loading={setHomeGym.isPending}
                onPress={() =>
                  setHomeGym.mutate(gym.id, { onSuccess: () => showToast(`${gym.name} is now your home gym`) })
                }
              >
                Set as home gym
              </Button>
            )}
            <Button variant="ghost" loading={fixingPin} onPress={runFixPin} accessibilityLabel="Fix gym pin location">
              Pin in the wrong spot? Fix it
            </Button>
            <Text variant="meta" className="text-center">
              Stand inside the gym and tap — the map pin moves to where you are, so check-ins work.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}
