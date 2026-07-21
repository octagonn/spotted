import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProofMedia } from "@/components/profile/cards";
import { LiftTag } from "@/components/ui/Chips";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { ACHIEVEMENTS } from "@/lib/redesignData";
import { colors } from "@/theme/colors";

export default function AchievementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const achievement = ACHIEVEMENTS.find((item) => item.id === id) ?? ACHIEVEMENTS[0];
  const title = achievement.kind === "maxlift" ? "Video" : "Achievement post";

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <PanelHeader title={title} sub={achievement.date} />
        <View style={{ marginHorizontal: 18, marginTop: 8 }}>
          <ProofMedia seed={achievement.id} video={achievement.video} duration={achievement.duration} />
          {achievement.kind === "maxlift" ? (
            <LiftTag style={{ position: "absolute", left: 12, top: 12 }}>{achievement.line}</LiftTag>
          ) : null}
        </View>
        <Text style={{ paddingHorizontal: 18, paddingTop: 14, fontSize: 13.5, lineHeight: 19, color: colors.mist }}>
          {achievement.video ? "Verified on camera. No spot needed." : "Milestone locked in."}
        </Text>
      </ScrollView>
    </View>
  );
}
