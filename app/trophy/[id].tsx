import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { Trophy as TrophyIcon } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProofMedia } from "@/components/profile/cards";
import { LiftTag } from "@/components/ui/Chips";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ACHIEVEMENTS, TROPHIES } from "@/lib/redesignData";
import { colors } from "@/theme/colors";

export default function TrophyScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const trophy = TROPHIES.find((item) => item.id === id) ?? TROPHIES[0];
  const proof = ACHIEVEMENTS.find((item) => item.id === trophy.proofId);
  const isDaily = trophy.proofKind === "daily post";
  const openProof = () => {
    if (proof) router.push(`/achievement/${proof.id}` as Href);
    else router.push("/daily/2026-07-12" as Href);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
        <PanelHeader title="Trophy" sub={trophy.category} />
        <View style={{ alignItems: "center", paddingTop: 18, paddingHorizontal: 18 }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1.5, borderColor: colors.mist, alignItems: "center", justifyContent: "center" }}>
            <TrophyIcon size={27} color={colors.white} />
          </View>
          <Text style={{ marginTop: 14, textAlign: "center", fontFamily: "Geist_700Bold", fontSize: 19, letterSpacing: 19 * -0.02, color: colors.white }}>
            {trophy.name}
          </Text>
          <Text style={{ marginTop: 5, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            {trophy.meta}{trophy.pinned ? " \u00b7 Pinned to profile" : ""}
          </Text>
        </View>
        <SectionLabel>Earned by this {trophy.proofKind}</SectionLabel>
        <Pressable onPress={openProof} style={{ marginHorizontal: 18 }}>
          <View>
            <ProofMedia seed={proof?.id ?? trophy.id} daily={isDaily} video={proof?.video} duration={proof?.duration} />
            {proof?.kind === "maxlift" ? (
              <LiftTag style={{ position: "absolute", left: 12, top: 12 }}>{proof.line}</LiftTag>
            ) : null}
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}
