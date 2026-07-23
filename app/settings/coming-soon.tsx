import { useLocalSearchParams } from "expo-router";
import { Hammer } from "lucide-react-native";
import { Text, View } from "react-native";

import { PanelHeader } from "@/components/ui/PanelHeader";
import { colors } from "@/theme/colors";

/** Clean empty-state backing every stubbed settings row (8a) — no dead taps. */
export default function ComingSoonScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title={title ?? "Coming soon"} />
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 48, paddingBottom: 80 }}>
        <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
          <Hammer size={22} color={colors.silver} strokeWidth={2} />
        </View>
        <Text style={{ marginTop: 16, fontFamily: "Geist_700Bold", fontSize: 15, color: colors.white }}>
          Coming soon
        </Text>
        <Text style={{ marginTop: 8, fontSize: 12.5, lineHeight: 18, color: colors.fog, textAlign: "center" }}>
          This section is on the way. Nothing here yet — check back after the next update.
        </Text>
      </View>
    </View>
  );
}
