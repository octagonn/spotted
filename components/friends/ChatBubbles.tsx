import { View } from "react-native";

import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

/**
 * Conversation bubble system:
 * - bubbles max-width 76%, radius 16;
 * - theirs: bone on raised + hairline; mine: right-aligned, black on white;
 * - group chats show the sender's first name above their bubbles;
 * - centered mono time separators ("Today 8:02 AM", "Yesterday", "Monday").
 */

export function TimeSeparator({ label }: { label: string }) {
  return (
    <Text variant="mono" className="text-center text-[10px] tracking-[0.6px] text-ash pt-3 pb-1">
      {label}
    </Text>
  );
}

type MessageBubbleProps = {
  text: string;
  mine: boolean;
  /** Group sender first name — rendered above the bubble. */
  senderFirst?: string;
  /** Sender's name for the screen-reader label (so "mine" vs "theirs" is audible). */
  senderName?: string;
};

export function MessageBubble({ text, mine, senderFirst, senderName }: MessageBubbleProps) {
  // A screen reader can't tell my bubble from theirs by alignment/color alone —
  // prefix the spoken text with who said it (WCAG 1.3.1).
  const who = mine ? "You" : (senderName ?? senderFirst);
  return (
    <View
      accessible
      accessibilityLabel={who ? `${who}: ${text}` : text}
      style={{
        maxWidth: "76%",
        alignSelf: mine ? "flex-end" : "flex-start",
        alignItems: mine ? "flex-end" : "flex-start",
        gap: 2
      }}
    >
      {!mine && senderFirst ? (
        <Text variant="label" className="pl-3 mt-[6px]">
          {senderFirst}
        </Text>
      ) : null}
      <View
        style={{
          paddingVertical: space[2] + 1,
          paddingHorizontal: space[3] + 1,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: mine ? colors.white : tokens.border.default,
          backgroundColor: mine ? colors.white : tokens.bg.raised
        }}
      >
        <Text variant="body-sm" className={mine ? "text-black" : "text-bone"}>
          {text}
        </Text>
      </View>
    </View>
  );
}
