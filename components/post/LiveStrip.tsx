import { router } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { Avatar, LiveRing } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { LiveBadge } from "@/components/ui/Chips";
import { Pressable } from "@/components/ui/Pressable";
import { useSheet } from "@/components/ui/Sheet";
import { useFriends } from "@/hooks/queries/useFriends";
import { useGymPresence } from "@/hooks/queries/useGymPresence";
import { showToast, useUiStore } from "@/stores/ui";
import { colors } from "@/theme/colors";
import type { LiveFriend } from "@/types/redesign";

/** Spot sheet (§4.5) — opened from a live friend in the strip. */
function SpotSheet({ friend, onClose }: { friend: LiveFriend; onClose: () => void }) {
  const spotted = useUiStore((state) => state.spottedIds.has(friend.id));
  const markSpotted = useUiStore((state) => state.markSpotted);
  const firstName = friend.name.split(" ")[0];
  return (
    <View style={{ alignItems: "center", paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 }}>
      <View style={{ alignItems: "center" }}>
        <LiveRing size={82} live>
          <Avatar name={friend.name} size={66} />
        </LiveRing>
        <LiveBadge style={{ marginTop: -6 }} />
      </View>
      <Text style={{ fontFamily: "Geist_700Bold", fontSize: 17, color: colors.white, marginTop: 14 }}>
        {`${firstName} is at the gym`}
      </Text>
      <Text style={{ fontFamily: "Geist_400Regular", fontSize: 13, color: colors.fog, marginTop: 4 }}>
        {`${friend.note} · ${friend.gym}`}
      </Text>
      <View style={{ flexDirection: "row", gap: 10, marginTop: 18, alignSelf: "stretch" }}>
        <View style={{ flex: 1 }}>
          <Button
            variant="ghost"
            onPress={() => {
              onClose();
              router.push(`/user/${friend.handle}`);
            }}
          >
            Profile
          </Button>
        </View>
        <View style={{ flex: 1.5 }}>
          <Button
            onPress={() => {
              if (!spotted) {
                markSpotted(friend.id);
                showToast(`You spotted ${firstName}`);
              }
              onClose();
            }}
          >
            {spotted ? "◎ Spotted" : "Send a spot"}
          </Button>
        </View>
      </View>
    </View>
  );
}

/** Live "Spot me" strip (§4.5) — real friends, live ring when checked in. */
export function LiveStrip() {
  const sheet = useSheet();
  const spottedIds = useUiStore((state) => state.spottedIds);
  const friends = useFriends();
  const presence = useGymPresence();

  const rows: LiveFriend[] = (friends.data ?? [])
    .map((person) => {
      const checkin = (presence.data?.presence ?? []).find((row) => row.profile.id === person.id);
      return {
        id: person.id,
        name: person.display_name,
        handle: person.username,
        live: Boolean(checkin),
        note: checkin ? "Checked in" : undefined,
        gym: checkin?.gym.name
      };
    })
    .sort((a, b) => Number(b.live) - Number(a.live));

  if (rows.length === 0) {
    return null;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 12, paddingHorizontal: 18, paddingTop: 6, paddingBottom: 4 }}
    >
      {rows.map((friend) => {
        const spotted = spottedIds.has(friend.id);
        const firstName = friend.name.split(" ")[0];
        return (
          <Pressable
            key={friend.id}
            style={{ width: 62, alignItems: "center", gap: 4 }}
            onPress={() => {
              if (friend.live) {
                sheet.open(<SpotSheet friend={friend} onClose={sheet.close} />);
              } else {
                router.push(`/user/${friend.handle}`);
              }
            }}
          >
            <LiveRing size={56} live={friend.live}>
              <Avatar name={friend.name} size={46} />
            </LiveRing>
            <Text
              numberOfLines={1}
              style={{ fontFamily: "Geist_400Regular", fontSize: 12, color: friend.live ? colors.mist : colors.fog, maxWidth: 64 }}
            >
              {spotted ? "◎ spotted" : firstName}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
