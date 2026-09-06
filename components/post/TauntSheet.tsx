import { Check, Shuffle } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import type { NotSpottedFriend } from "@/hooks/queries/useNotSpotted";
import { useSendTaunt, type TauntSource } from "@/hooks/queries/useTaunts";
import { suggestTauntLines, type TauntLine } from "@/lib/tauntLines";
import { showToast } from "@/stores/ui";
import { icon, radius, space, tokens } from "@/theme/tokens";

type TauntSheetProps = {
  friend: Pick<NotSpottedFriend, "user_id" | "username" | "display_name" | "avatar_url" | "current_streak">;
  source?: TauntSource;
};

function subline(streak: number): string {
  if (streak >= 2) return `${streak}-day streak on the line. Not spotted yet today.`;
  if (streak === 1) return "1-day streak on the line. Not spotted yet today.";
  return "Not spotted yet today.";
}

/**
 * Taunt picker for the Not-Spotted rail: three suggested lines, Shuffle for
 * three more, one Send. (The Friends-list button still fires a random line
 * without a sheet — this is the deliberate, "I picked this one" path.)
 */
export function TauntSheet({ friend, source = "rail" }: TauntSheetProps) {
  const sheet = useSheet();
  const sendTaunt = useSendTaunt();
  const [lines, setLines] = useState<TauntLine[]>(() => suggestTauntLines(3));
  const [selectedId, setSelectedId] = useState<string>(() => lines[0]?.id ?? "");
  const name = friend.display_name?.trim() || friend.username;

  const shuffle = () => {
    const next = suggestTauntLines(
      3,
      lines.map((line) => line.id)
    );
    setLines(next);
    setSelectedId(next[0]?.id ?? "");
  };

  const send = () => {
    const line = lines.find((l) => l.id === selectedId) ?? lines[0];
    if (!line || sendTaunt.isPending) return;
    sendTaunt.mutate(
      { targetId: friend.user_id, lineId: line.id, lineText: line.text, source },
      {
        // Errors toast inside useSendTaunt (and the rail tile rolls back).
        onSuccess: () => {
          sheet.close();
          showToast(`Taunt sent to ${name}`);
        }
      }
    );
  };

  return (
    <View style={{ paddingBottom: space[2] }}>
      {/* SheetTitle/SheetSub carry their own 20px side padding; the negative
          margin pulls the text to a 12px gap from the avatar. */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 20, paddingTop: space[3] }}>
        <Avatar name={name} uri={friend.avatar_url} size={44} />
        <View style={{ flex: 1, marginLeft: -space[2] }}>
          <SheetTitle>{`Taunt ${name}`}</SheetTitle>
          <SheetSub>{subline(friend.current_streak)}</SheetSub>
        </View>
      </View>

      <View style={{ paddingHorizontal: space[4], paddingTop: space[2], gap: space[2] }}>
        {lines.map((line) => {
          const selected = line.id === selectedId;
          return (
            <Pressable
              key={line.id}
              haptic="selection"
              onPress={() => setSelectedId(line.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={line.text}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: space[3],
                paddingVertical: space[3],
                paddingHorizontal: space[4],
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: selected ? tokens.text.primary : tokens.border.default,
                backgroundColor: selected ? tokens.bg.subtle : tokens.bg.raised
              }}
            >
              <Text variant="body" className={selected ? "text-white flex-1" : "text-silver flex-1"}>
                {line.text}
              </Text>
              {selected ? (
                <Check size={icon.size.sm} color={tokens.text.primary} strokeWidth={icon.stroke.bold} />
              ) : null}
            </Pressable>
          );
        })}

        <Pressable
          haptic="none"
          onPress={shuffle}
          accessibilityRole="button"
          accessibilityLabel="Shuffle lines"
          style={{ flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: space[2], paddingVertical: space[2] }}
        >
          <Shuffle size={icon.size.sm} color={tokens.text.secondary} strokeWidth={icon.stroke.regular} />
          <Text variant="label" className="text-silver">
            Shuffle
          </Text>
        </Pressable>

        <Button onPress={send} loading={sendTaunt.isPending} disabled={!selectedId}>
          Send taunt
        </Button>
        <Text variant="meta" className="text-center">
          They get one push. You get credit when they post.
        </Text>
      </View>
    </View>
  );
}
