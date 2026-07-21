import { useRouter, type Href } from "expo-router";
import { Dumbbell } from "lucide-react-native";
import { Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { useJoinGymCommunity } from "@/hooks/queries/useCommunities";
import { useGymPresence } from "@/hooks/queries/useGymPresence";
import type { MapGym } from "@/hooks/queries/useMapGyms";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/** Real gym preview: address, friends here now, join-the-gym-community CTA. */
export function GymPreviewSheet({ gym, close }: { gym: MapGym; close: () => void }) {
  const router = useRouter();
  const presence = useGymPresence();
  const joinGym = useJoinGymCommunity();

  const hereNow = (presence.data?.presence ?? []).filter((row) => row.gym.id === gym.id);

  const openCommunity = () => {
    joinGym.mutate(gym.id, {
      onSuccess: (communityId) => {
        showToast(`Joined ${gym.name}`);
        close();
        router.push(`/community/${communityId}` as Href);
      },
      onError: () => showToast("Couldn't join right now — try again")
    });
  };

  return (
    <View style={{ paddingHorizontal: 20 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8 }}>
        <View style={{ width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: colors.mist, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}>
          <Dumbbell size={20} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 17, color: colors.white }}>{gym.name}</Text>
          {gym.address ? (
            <Text style={{ marginTop: 2, fontSize: 12.5, color: colors.fog }}>{gym.address}</Text>
          ) : null}
        </View>
      </View>

      {hereNow.length ? (
        <View style={{ marginTop: 14, borderWidth: 1, borderColor: colors.slate, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.035)" }}>
          {hereNow.map((person) => (
            <Pressable
              key={person.id}
              onPress={() => {
                if (!person.profile.username) return;
                close();
                router.push(`/user/${person.profile.username}` as Href);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: 10 }}
              accessibilityLabel={person.profile.display_name}
            >
              <Avatar name={person.profile.display_name} uri={person.profile.avatar_url} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.bone }}>
                  {person.profile.display_name}
                </Text>
                <Text style={{ marginTop: 1, fontSize: 11, color: colors.fog }}>Checked in now</Text>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={{ marginTop: 14, borderWidth: 1, borderStyle: "dashed", borderColor: colors.slate, borderRadius: 12, padding: 12 }}>
          <Text style={{ fontSize: 11.5, lineHeight: 16, color: colors.fog }}>
            ○ No friends here right now.
          </Text>
        </View>
      )}

      <View style={{ paddingTop: 16 }}>
        <Button onPress={openCommunity} loading={joinGym.isPending}>
          Join gym community
        </Button>
      </View>
    </View>
  );
}
