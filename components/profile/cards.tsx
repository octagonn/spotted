import { Text, View } from "react-native";

import { PlayBadge, VidDur } from "@/components/ui/Chips";
import { Pressable } from "@/components/ui/Pressable";
import { FbInset, SceneMedia } from "@/components/profile/media";
import { colors } from "@/theme/colors";
import type { Achievement } from "@/types/redesign";

export function AchievementCard({ achievement, onPress }: { achievement: Achievement; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: "48.5%" }}>
      <SceneMedia seed={achievement.id} aspectRatio={3 / 4} radius={14} borderWidth={1} borderColor={colors.slate}>
        <View
          style={{
            position: "absolute",
            top: 9,
            left: 9,
            borderRadius: 6,
            backgroundColor: "rgba(0,0,0,0.7)",
            paddingVertical: 4,
            paddingHorizontal: 7
          }}
        >
          <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 9, color: colors.white }}>
            {achievement.tag}
          </Text>
        </View>
        {achievement.video ? (
          <PlayBadge size={28} style={{ position: "absolute", right: 9, bottom: 9 }} />
        ) : null}
        <View style={{ position: "absolute", left: 10, right: 42, bottom: 9 }}>
          <Text style={{ fontFamily: "Geist_700Bold", fontSize: 11, color: colors.white }}>
            {achievement.line}
          </Text>
          <Text style={{ marginTop: 2, fontFamily: "Geist_500Medium", fontSize: 10.5, color: colors.fog }}>
            {achievement.date}
          </Text>
        </View>
      </SceneMedia>
    </Pressable>
  );
}

export function DailyCell({
  id,
  date,
  missed,
  onPress
}: {
  id: string;
  date: string;
  missed?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <View
      style={{
        width: "100%",
        aspectRatio: 3 / 4,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: colors.graphite,
        backgroundColor: colors.graphite,
        overflow: "hidden"
      }}
    >
      {missed ? (
        <Text style={{ margin: "auto", fontSize: 19, color: colors.slate }}>{"\u00d7"}</Text>
      ) : (
        <SceneMedia seed={id} style={{ position: "absolute", inset: 0 }}>
          <FbInset seed={id} widthPct={0.34} radius={5} borderWidth={1} offset={4} shadow={false} />
        </SceneMedia>
      )}
      <Text
        style={{
          position: "absolute",
          left: 7,
          bottom: 6,
          fontFamily: "GeistMono_500Medium",
          fontSize: 9.5,
          color: colors.white
        }}
      >
        {date}
      </Text>
    </View>
  );
  return (
    <View style={{ width: "23.5%" }}>
      {onPress && !missed ? <Pressable onPress={onPress}>{content}</Pressable> : content}
    </View>
  );
}

export function ProofMedia({
  seed,
  daily,
  video,
  duration
}: {
  seed: string;
  daily?: boolean;
  video?: boolean;
  duration?: string;
}) {
  return (
    <SceneMedia seed={seed} aspectRatio={3 / 4} radius={14} borderWidth={1} borderColor={colors.slate}>
      {daily ? <FbInset seed={seed} /> : null}
      {video ? (
        <>
          <PlayBadge style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -28, marginTop: -28 }} />
          {duration ? <VidDur style={{ position: "absolute", right: 10, bottom: 10 }}>{duration}</VidDur> : null}
        </>
      ) : null}
    </SceneMedia>
  );
}
