import { useRouter, type Href } from "expo-router";
import { View } from "react-native";

import { GymLogo } from "@/components/GymLogo";
import { GymFallbackIcon } from "@/components/map/GymRow";
import { Button } from "@/components/ui/Button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Text } from "@/components/ui/Text";
import { UserRow } from "@/components/ui/UserRow";
import { useGymPresence } from "@/hooks/queries/useGymPresence";
import type { MapGym } from "@/hooks/queries/useMapGyms";
import { useSetHomeGym } from "@/hooks/queries/useProfileExtras";
import { showToast } from "@/stores/ui";
import { space } from "@/theme/tokens";

/** Gym preview: identity, friends here now (gym-level presence only), home-gym CTA. */
export function GymPreviewSheet({ gym, close }: { gym: MapGym; close: () => void }) {
  const router = useRouter();
  const presence = useGymPresence();
  const hereNow = (presence.data?.presence ?? []).filter((row) => row.gym.id === gym.id);

  const setHomeGym = useSetHomeGym();
  const makeHomeGym = () => {
    setHomeGym.mutate(gym.id, {
      onSuccess: () => {
        showToast(`${gym.name} is now your home gym`);
        close();
      }
    });
  };
  const openGym = () => {
    close();
    router.push(`/gym/${gym.id}` as Href);
  };

  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingHorizontal: space[4] + 4,
          paddingTop: space[2]
        }}
      >
        <GymLogo gym={gym} size={48} fallback={<GymFallbackIcon size={48} />} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="subheading" accessibilityRole="header" numberOfLines={2}>
            {gym.name}
          </Text>
          {gym.address ? (
            <Text variant="meta" numberOfLines={2}>
              {gym.address}
            </Text>
          ) : null}
        </View>
      </View>

      <SectionLabel style={{ paddingHorizontal: space[4] + 4, paddingTop: space[4], paddingBottom: space[1] }}>
        Here now
      </SectionLabel>
      {hereNow.length ? (
        hereNow.map((person) => (
          <UserRow
            key={person.id}
            name={person.profile.display_name}
            avatarUrl={person.profile.avatar_url}
            sub="Checked in now"
            onPress={
              person.profile.username
                ? () => {
                    close();
                    router.push(`/user/${person.profile.username}` as Href);
                  }
                : undefined
            }
          />
        ))
      ) : (
        <Text variant="meta" className="px-6 py-2">
          No friends here right now.
        </Text>
      )}

      <View style={{ paddingHorizontal: space[4] + 4, paddingTop: space[4], gap: space[2] }}>
        <Button onPress={makeHomeGym} loading={setHomeGym.isPending}>
          Set as home gym
        </Button>
        <Button variant="ghost" onPress={openGym} accessibilityLabel={`Open ${gym.name}`}>
          View gym
        </Button>
      </View>
    </View>
  );
}
