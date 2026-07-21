import { useRouter } from "expo-router";
import { Send, X } from "lucide-react-native";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { colors } from "@/theme/colors";

export type CommentRow = {
  id: string;
  name: string;
  handle: string;
  avatarUrl?: string | null;
  text: string;
  time: string;
};

function mono(size: number, color: string) {
  return { fontFamily: "GeistMono_400Regular", fontSize: size, color };
}

/**
 * Bottom-anchored comments sheet. A KeyboardAvoidingView keeps the input (and
 * the recent comments) above the keyboard while typing — fixing the inline-feed
 * bug where the keyboard covered the comment field.
 */
export function CommentsSheet({
  visible,
  onClose,
  comments,
  myName,
  myAvatarUri,
  draft,
  onChangeDraft,
  onSubmit,
  loading = false
}: {
  visible: boolean;
  onClose: () => void;
  comments: CommentRow[];
  myName: string;
  myAvatarUri: string | null;
  draft: string;
  onChangeDraft: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const router = useRouter();
  const openProfile = (handle: string) => {
    onClose();
    router.push(`/user/${handle.replace(/^@/, "")}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close comments" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          {/* Fixed tall sheet (85% of screen) so it always fills like Instagram —
              no content-sized gap, and the comment list flexes to fill. */}
          <View
            style={{
              height: height * 0.85,
              backgroundColor: colors.ink,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderWidth: 1,
              borderBottomWidth: 0,
              borderColor: colors.iron,
              paddingBottom: insets.bottom + 10
            }}
          >
            {/* Grabber + header */}
            <View style={{ alignItems: "center", paddingTop: 10 }}>
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.slate }} />
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingTop: 12, paddingBottom: 12 }}>
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 15, color: colors.white }}>Comments</Text>
              <Pressable onPress={onClose} accessibilityLabel="Close" hitSlop={10} style={{ position: "absolute", right: 16, top: 10 }}>
                <X size={18} color={colors.fog} strokeWidth={2.4} />
              </Pressable>
            </View>

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12, gap: 12 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {loading && comments.length === 0 ? (
                <Text style={{ fontSize: 12.5, color: colors.fog }}>Loading comments…</Text>
              ) : comments.length === 0 ? (
                <Text style={{ fontSize: 12.5, color: colors.fog }}>No comments yet. Say something.</Text>
              ) : (
                comments.map((comment) => (
                  <View key={comment.id} style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
                    <Pressable onPress={() => openProfile(comment.handle)} accessibilityLabel={`Open ${comment.handle}`}>
                      <Avatar name={comment.name} uri={comment.avatarUrl} size={28} />
                    </Pressable>
                    <Text style={{ flex: 1, fontSize: 13, color: colors.mist, lineHeight: 13 * 1.4 }}>
                      <Text onPress={() => openProfile(comment.handle)} style={{ fontFamily: "Geist_700Bold", color: colors.white }}>
                        {comment.handle}
                      </Text>
                      {"  "}
                      {comment.text}
                      {"  "}
                      <Text style={mono(10, colors.ash)}>{comment.time}</Text>
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>

            {/* Input row — stays above the keyboard */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 16,
                paddingTop: 10,
                borderTopWidth: 1,
                borderTopColor: colors.graphite
              }}
            >
              <Avatar name={myName} uri={myAvatarUri} size={30} />
              <TextInput
                value={draft}
                onChangeText={onChangeDraft}
                onSubmitEditing={onSubmit}
                placeholder="Add a comment…"
                placeholderTextColor={colors.ash}
                autoFocus
                returnKeyType="send"
                style={{
                  flex: 1,
                  backgroundColor: colors.graphite,
                  borderWidth: 1,
                  borderColor: colors.iron,
                  borderRadius: 999,
                  paddingVertical: 9,
                  paddingHorizontal: 16,
                  fontSize: 13,
                  color: colors.bone,
                  fontFamily: "Geist_400Regular"
                }}
              />
              <Pressable
                onPress={onSubmit}
                accessibilityLabel="Post comment"
                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}
              >
                <Send size={15} color={colors.black} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
