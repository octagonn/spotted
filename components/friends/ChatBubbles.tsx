import { Text, View } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Conversation bubble system (spec §5.2):
 * - bubbles max-width 76%, padding 9×13, radius 16, 13.5px lh 1.4;
 * - theirs: bone on charcoal + 1px iron border; mine: right-aligned, black on white;
 * - group chats show the sender's first name above their bubbles;
 * - centered mono time separators ("Today 8:02 AM", "Yesterday", "Monday").
 */

export function TimeSeparator({ label }: { label: string }) {
  return (
    <Text
      style={{
        textAlign: "center",
        fontFamily: "GeistMono_400Regular",
        fontSize: 10,
        color: colors.ash,
        letterSpacing: 10 * 0.06,
        paddingTop: 12,
        paddingBottom: 6
      }}
    >
      {label}
    </Text>
  );
}

type MessageBubbleProps = {
  text: string;
  mine: boolean;
  /** Group sender first name — rendered above the bubble (`.who`, §5.2). */
  senderFirst?: string;
};

export function MessageBubble({ text, mine, senderFirst }: MessageBubbleProps) {
  return (
    <View
      style={{
        maxWidth: "76%",
        alignSelf: mine ? "flex-end" : "flex-start",
        alignItems: mine ? "flex-end" : "flex-start",
        gap: 2
      }}
    >
      {!mine && senderFirst ? (
        <Text
          style={{
            fontFamily: "Geist_600SemiBold",
            fontSize: 10.5,
            color: colors.fog,
            paddingLeft: 12,
            marginTop: 6
          }}
        >
          {senderFirst}
        </Text>
      ) : null}
      <View
        style={{
          paddingVertical: 9,
          paddingHorizontal: 13,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: mine ? colors.white : colors.iron,
          backgroundColor: mine ? colors.white : colors.charcoal
        }}
      >
        <Text
          style={{
            fontFamily: "Geist_400Regular",
            fontSize: 13.5,
            lineHeight: 13.5 * 1.4,
            color: mine ? colors.black : colors.bone
          }}
        >
          {text}
        </Text>
      </View>
    </View>
  );
}
