import { Eye, Heart, Plus, Send } from "lucide-react-native";
import type { RefObject } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/** Reply field border over a photo — a story-only exception. */
const FIELD_BORDER = "rgba(255,255,255,0.4)";
const PLACEHOLDER = "rgba(255,255,255,0.6)";

/** Own story: viewer count left, Add right. */
export function StoryOwnerBar({
  seenCount,
  immersed,
  onOpenViewers,
  onAdd
}: {
  seenCount: number | undefined;
  immersed: boolean;
  onOpenViewers: () => void;
  onAdd: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents={immersed ? "none" : "auto"}
      style={{
        position: "absolute",
        bottom: insets.bottom + space[4],
        left: space[3] + 2,
        right: space[3] + 2,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        opacity: immersed ? 0 : 1
      }}
    >
      <Pressable onPress={onOpenViewers} accessibilityLabel="See who viewed your story" hitSlop={8}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[1] + 3,
            paddingVertical: space[2] + 1,
            paddingHorizontal: space[3] + 2,
            borderRadius: radius.pill,
            backgroundColor: tokens.bg.scrim
          }}
        >
          <Eye size={15} color={colors.white} strokeWidth={icon.stroke.regular} />
          <Text variant="meta-strong" className="text-white">
            {seenCount ? `Seen by ${seenCount}` : "Seen by"}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onAdd} accessibilityLabel="Add another story">
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[1] + 2,
            height: 38,
            paddingHorizontal: space[4],
            borderRadius: radius.pill,
            backgroundColor: colors.white
          }}
        >
          <Plus size={15} color={colors.black} strokeWidth={icon.stroke.bold} />
          <Text variant="meta-strong" className="text-black">
            Add
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

/** Someone else's story: reply field that DMs the poster, or a like heart. */
export function StoryReplyBar({
  inputRef,
  draft,
  onChangeDraft,
  onSend,
  onFocus,
  onBlur,
  typing,
  keyboardHeight,
  immersed,
  firstName,
  liked,
  onToggleLike
}: {
  inputRef: RefObject<TextInput | null>;
  draft: string;
  onChangeDraft: (text: string) => void;
  onSend: () => void;
  onFocus: () => void;
  onBlur: () => void;
  typing: boolean;
  keyboardHeight: number;
  immersed: boolean;
  firstName: string;
  liked: boolean;
  onToggleLike: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents={immersed ? "none" : "auto"}
      style={{
        position: "absolute",
        opacity: immersed ? 0 : 1,
        // KAV padding can't move an absolutely-positioned bar — pin it to the
        // top of the keyboard ourselves.
        bottom: Platform.OS === "ios" ? keyboardHeight : 0,
        left: 0,
        right: 0,
        paddingHorizontal: space[3] + 2,
        paddingBottom: typing ? space[2] + 2 : insets.bottom + space[3],
        paddingTop: space[2] + 2,
        flexDirection: "row",
        alignItems: "center",
        gap: space[2] + 2
      }}
    >
      <TextInput
        ref={inputRef}
        value={draft}
        onChangeText={onChangeDraft}
        onFocus={onFocus}
        onBlur={onBlur}
        onSubmitEditing={onSend}
        placeholder={`Reply to ${firstName}…`}
        placeholderTextColor={PLACEHOLDER}
        returnKeyType="send"
        accessibilityLabel="Reply"
        style={{
          flex: 1,
          minHeight: 44,
          borderWidth: 1,
          borderColor: FIELD_BORDER,
          borderRadius: radius.pill,
          paddingHorizontal: space[4] + 2,
          paddingVertical: space[2] + 2,
          fontSize: 15,
          color: colors.white,
          fontFamily: "Geist_400Regular"
        }}
      />
      {draft.trim().length > 0 ? (
        <Pressable
          onPress={onSend}
          accessibilityLabel="Send reply"
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            backgroundColor: colors.white,
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Send size={icon.size.xs + 2} color={colors.black} strokeWidth={icon.stroke.bold} />
        </Pressable>
      ) : (
        <Pressable
          onPress={onToggleLike}
          accessibilityLabel={liked ? "Unlike story" : "Like story"}
          hitSlop={8}
          style={{ width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" }}
        >
          <Heart
            size={icon.size.lg}
            color={liked ? tokens.status.like : colors.white}
            fill={liked ? tokens.status.like : "transparent"}
            strokeWidth={icon.stroke.regular}
          />
        </Pressable>
      )}
    </View>
  );
}
