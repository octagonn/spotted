import { useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Privacy, Terms } from "@/components/LegalModal";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { PRIVACY_MD, TERMS_MD } from "@/lib/legalContent";
import { colors } from "@/theme/colors";

/**
 * Minimal markdown-ish renderer for final legal copy: # / ## headings,
 * "- " bullets, blank-line paragraphs. Keeps the drop-in path (8b) free of
 * native markdown dependencies.
 */
function MarkdownLite({ source }: { source: string }) {
  const blocks = source.split(/\n{2,}/);
  return (
    <View style={{ gap: 4 }}>
      {blocks.map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("## ")) {
          return (
            <Text key={i} accessibilityRole="header" style={{ marginTop: 18, fontFamily: "Geist_700Bold", fontSize: 15, color: colors.white }}>
              {trimmed.slice(3)}
            </Text>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <Text key={i} accessibilityRole="header" style={{ marginTop: 22, fontFamily: "Geist_700Bold", fontSize: 18, color: colors.white }}>
              {trimmed.slice(2)}
            </Text>
          );
        }
        if (trimmed.split("\n").every((line) => line.trim().startsWith("- "))) {
          return (
            <View key={i} style={{ marginTop: 8, gap: 6 }}>
              {trimmed.split("\n").map((line, j) => (
                <View key={j} style={{ flexDirection: "row", gap: 8, paddingLeft: 6 }}>
                  <Text style={{ fontSize: 13.5, color: colors.mist }}>·</Text>
                  <Text style={{ flex: 1, fontSize: 13.5, lineHeight: 20, color: colors.bone }}>
                    {line.trim().slice(2)}
                  </Text>
                </View>
              ))}
            </View>
          );
        }
        return (
          <Text key={i} style={{ marginTop: 8, fontSize: 13.5, lineHeight: 20, color: colors.bone }}>
            {trimmed}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * Routed legal document screens (8b): /settings/legal/terms and
 * /settings/legal/privacy. Final copy pasted into lib/legalContent.ts takes
 * precedence; until then the built-in in-app copy renders.
 */
export default function LegalDocScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const insets = useSafeAreaInsets();
  const isTerms = doc !== "privacy";
  const override = isTerms ? TERMS_MD : PRIVACY_MD;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title={isTerms ? "Terms of Service" : "Privacy Policy"} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32 }}>
        {override.trim() ? <MarkdownLite source={override} /> : isTerms ? <Terms /> : <Privacy />}
      </ScrollView>
    </View>
  );
}
