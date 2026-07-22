import { Lock } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { useSendTaunt } from "@/hooks/queries/useTaunts";
import { useTrophies } from "@/hooks/useTrophies";
import { TAUNT_LINES } from "@/lib/tauntLines";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/**
 * Canned-line taunt picker (spec B). Base lines always sendable; trophy-gated
 * lines render locked with the trophy that unlocks them. All eligibility and
 * limits are re-validated server-side on send.
 */
export function TauntPickerSheet({ targetId, name }: { targetId: string; name: string }) {
  const sheet = useSheet();
  const send = useSendTaunt();
  const { earned } = useTrophies();
  const [pending, setPending] = useState(false);

  const earnedFamilies = new Set(earned.map((e) => e.def.id));

  const fire = (lineId: string, lineText: string) => {
    if (pending) return;
    setPending(true);
    send.mutate(
      { targetId, lineId, lineText },
      {
        onSuccess: () => {
          sheet.close();
          showToast("Taunt sent 😈");
        },
        onError: (error) => {
          setPending(false);
          showToast(error.message);
        }
      }
    );
  };

  return (
    <View>
      <SheetTitle>{`Taunt ${name.split(" ")[0]}`}</SheetTitle>
      <SheetSub>They haven't posted today. One tap — they get a push. 1 per friend per day.</SheetSub>
      {TAUNT_LINES.map((line) => {
        const locked = Boolean(line.requiresTrophy) && !earnedFamilies.has(line.requiresTrophy as string);
        return (
          <Pressable
            key={line.id}
            disabled={locked || pending}
            onPress={() => fire(line.id, line.text)}
            accessibilityLabel={locked ? `${line.text} — locked` : line.text}
          >
            <View
              style={{
                marginHorizontal: 20,
                marginTop: 8,
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: locked ? colors.graphite : colors.iron,
                backgroundColor: locked ? "transparent" : colors.graphite,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                opacity: locked ? 0.6 : 1
              }}
            >
              <Text style={{ flex: 1, fontFamily: "Geist_500Medium", fontSize: 13.5, color: locked ? colors.fog : colors.bone }}>
                {line.text}
              </Text>
              {locked ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Lock size={11} color={colors.gold} strokeWidth={2.2} />
                  <Text style={{ fontSize: 10.5, color: colors.gold }}>{line.requiresTrophyName}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
