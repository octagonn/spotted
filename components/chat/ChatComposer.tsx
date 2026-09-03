import { Image } from "expo-image";
import { Camera, CornerUpLeft, ImagePlus, Mic, Send, Square, X } from "lucide-react-native";
import { TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

export type PendingMedia = { uri: string; kind: "image" | "video"; viewOnce: boolean };
export type ReplyTarget = { id: string; text: string; mine: boolean };

type ChatComposerProps = {
  draft: string;
  onChangeDraft: (text: string) => void;
  onSend: () => void;
  canSend: boolean;
  sending: boolean;
  placeholder: string;
  editable: boolean;
  keyboardVisible: boolean;
  /** Reply-to preview above the field. */
  replyTo: ReplyTarget | null;
  replyToName: string;
  onCancelReply: () => void;
  /** Staged media preview above the field. */
  pendingMedia: PendingMedia | null;
  onRemoveMedia: () => void;
  /** Media actions — omitted entirely for mock threads. */
  mediaActions?: {
    disabled: boolean;
    onCamera: () => void;
    onPickImage: () => void;
    onToggleRecord: () => void;
    recording: boolean;
    recordSecs: number;
  };
};

const ICON_COLOR = (disabled: boolean) => (disabled ? tokens.border.default : tokens.text.secondary);

/** Composer: staged media · reply preview · camera / gallery / mic · field · send. */
export function ChatComposer({
  draft,
  onChangeDraft,
  onSend,
  canSend,
  sending,
  placeholder,
  editable,
  keyboardVisible,
  replyTo,
  replyToName,
  onCancelReply,
  pendingMedia,
  onRemoveMedia,
  mediaActions
}: ChatComposerProps) {
  const insets = useSafeAreaInsets();
  const recording = mediaActions?.recording ?? false;
  const armed = canSend && !recording;
  return (
    <View
      style={{
        paddingHorizontal: space[4],
        paddingTop: space[2] + 2,
        paddingBottom: keyboardVisible ? space[2] + 2 : insets.bottom + space[3] + 2,
        backgroundColor: colors.black
      }}
    >
      {pendingMedia ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] + 2, marginBottom: space[2] }}>
          <View
            style={{
              borderRadius: radius.sm,
              overflow: "hidden",
              borderWidth: 1,
              borderColor: pendingMedia.viewOnce ? tokens.accent.gold : tokens.border.default
            }}
          >
            <Image source={{ uri: pendingMedia.uri }} style={{ width: 52, height: 66 }} contentFit="cover" />
          </View>
          <Text variant="meta" className="flex-1 text-silver">
            {pendingMedia.viewOnce
              ? "View-once photo — they can open it one time"
              : pendingMedia.kind === "video"
                ? "Video ready to send"
                : "Photo ready to send"}
          </Text>
          <Pressable onPress={onRemoveMedia} haptic="none" accessibilityLabel="Remove attachment" hitSlop={8}>
            <X size={icon.size.xs} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
          </Pressable>
        </View>
      ) : null}
      {replyTo ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[2],
            marginBottom: space[2],
            paddingLeft: space[2] + 2,
            borderLeftWidth: 2,
            borderLeftColor: tokens.border.strong
          }}
        >
          <CornerUpLeft size={14} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
          <Text variant="meta" numberOfLines={1} className="flex-1 text-silver">
            Replying to {replyTo.mine ? "yourself" : replyToName}: {replyTo.text}
          </Text>
          <Pressable onPress={onCancelReply} haptic="none" accessibilityLabel="Cancel reply" hitSlop={8}>
            <X size={icon.size.xs} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
          </Pressable>
        </View>
      ) : null}
      <View
        style={{
          minHeight: 46,
          flexDirection: "row",
          alignItems: "center",
          gap: space[2] + 2,
          borderWidth: 1,
          borderColor: tokens.border.default,
          borderRadius: radius.pill,
          backgroundColor: tokens.bg.raised,
          paddingLeft: space[4],
          paddingRight: 5,
          paddingVertical: 5
        }}
      >
        {mediaActions ? (
          <>
            <Pressable
              onPress={mediaActions.onCamera}
              haptic="none"
              accessibilityLabel="Take a view-once photo"
              hitSlop={6}
              disabled={mediaActions.disabled}
            >
              <Camera size={icon.size.sm} color={ICON_COLOR(mediaActions.disabled)} strokeWidth={icon.stroke.regular} />
            </Pressable>
            <Pressable
              onPress={mediaActions.onPickImage}
              haptic="none"
              accessibilityLabel="Attach a photo"
              hitSlop={6}
              disabled={mediaActions.disabled}
            >
              <ImagePlus
                size={icon.size.sm}
                color={ICON_COLOR(mediaActions.disabled)}
                strokeWidth={icon.stroke.regular}
              />
            </Pressable>
            <Pressable
              onPress={mediaActions.onToggleRecord}
              haptic="impact"
              accessibilityLabel={recording ? "Stop and send voice message" : "Record a voice message"}
              hitSlop={6}
            >
              {recording ? (
                <Square
                  size={icon.size.xs + 2}
                  color={colors.white}
                  strokeWidth={icon.stroke.regular}
                  fill={colors.white}
                />
              ) : (
                <Mic size={icon.size.sm} color={tokens.text.secondary} strokeWidth={icon.stroke.regular} />
              )}
            </Pressable>
          </>
        ) : null}
        {recording ? (
          <Text variant="mono" className="flex-1 py-[7px] text-[13px] text-white">
            {`● Recording… 0:${String(mediaActions?.recordSecs ?? 0).padStart(2, "0")}`}
          </Text>
        ) : (
          <TextInput
            value={draft}
            onChangeText={onChangeDraft}
            placeholder={placeholder}
            placeholderTextColor={tokens.text.tertiary}
            editable={editable}
            returnKeyType="send"
            onSubmitEditing={onSend}
            accessibilityLabel="Message"
            style={{ flex: 1, paddingVertical: 7, fontFamily: "Geist_400Regular", fontSize: 15, color: colors.bone }}
          />
        )}
        <Pressable
          onPress={onSend}
          disabled={!armed || sending}
          haptic={armed ? "impact" : "none"}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.pill,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: armed ? colors.white : tokens.bg.subtle
            }}
          >
            <Send
              color={armed ? colors.black : tokens.text.tertiary}
              size={icon.size.xs}
              strokeWidth={icon.stroke.bold}
            />
          </View>
        </Pressable>
      </View>
    </View>
  );
}
