import { useLocalSearchParams } from "expo-router";
import { Hammer } from "lucide-react-native";
import { View } from "react-native";

import { EmptyState } from "@/components/ui/EmptyState";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { colors } from "@/theme/colors";

/** Clean empty-state backing every stubbed settings row (8a) — no dead taps. */
export default function ComingSoonScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title={title ?? "Coming soon"} />
      <EmptyState
        center
        icon={<Hammer size={22} color={colors.silver} strokeWidth={2} />}
        title="Coming soon"
        body="This section is on the way. Nothing here yet — check back after the next update."
      />
    </View>
  );
}
