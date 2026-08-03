import { useRouter } from "expo-router";
import { Send, X } from "lucide-react-native";
import {
  Alert,
  Keyboard,
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
import { SkeletonCommentRow } from "@/components/ui/Skeleton";
import { colors } from "@/theme/colors";

export type CommentRow = {
  id: string;
  /** Author's user id — for the "can I delete this?" check. */
  userId?: string | null;
  name: string;
  handle: string;
  avatarUrl?: string | null;
  text: string;
  time: string;
  /** Parent comment id when this row is a reply. */
  parentId?: string | null;
};

export type ReplyTarget = { id: string; handle: string };

function mono(size: number, color: string) {
  return { fontFamily: "GeistMono_400Regular", fontSize: size, color };
}

/** One comment (or reply) — sized to read comfortably, with a Reply action. */
function CommentLine({
  comment,
  onOpenProfile,
  onReply,
  replyParent,
  canDelete = false,
  onDelete
}: {
  comment: CommentRow;
  onOpenProfile: (handle: string) => void;
  onReply?: (target: ReplyTarget | null) => void;
  /** When rendering a reply, the top-level parent replies thread onto. */
  replyParent?: CommentRow;
  canDelete?: boolean;
  onDelete?: (commentId: string) => void;
}) {
  return (
    <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
      <Pressable onPress={() => onOpenProfile(comment.handle)} accessibilityLabel={`Open ${comment.handle}`}>
        <Avatar name={comment.name} uri={comment.avatarUrl} size={replyParent ? 30 : 38} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Text onPress={() => onOpenProfile(comment.handle)} style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.white }}>
            {comment.handle}
          </Text>
          <Text style={mono(11, colors.ash)}>{comment.time}</Text>
        </View>
        <Text style={{ marginTop: 3, fontSize: 15.5, lineHeight: 22, color: colors.bone }}>{comment.text}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 4 }}>
          {onReply ? (
            <Pressable
              onPress={() => onReply({ id: replyParent ? replyParent.id : comment.id, handle: comment.handle })}
              accessibilityLabel={`Reply to ${comment.handle}`}
              hitSlop={6}
            >
              <Text style={{ fontSize: 12.5, fontFamily: "Geist_600SemiBold", color: colors.fog }}>Reply</Text>
            </Pressable>
          ) : null}
          {canDelete && onDelete ? (
            <Pressable
              onPress={() =>
                Alert.alert("Delete comment?", "This removes it for everyone.", [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => onDelete(comment.id) }
                ])
              }
              accessibilityLabel="Delete comment"
              hitSlop={6}
            >
              <Text style={{ fontSize: 12.5, fontFamily: "Geist_600SemiBold", color: "#E5484D" }}>Delete</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
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
  replyTo = null,
  onReply,
  myUserId,
  canModerate = false,
  onDelete,
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
  /** Active reply target - composer shows "Replying to @x". */
  replyTo?: ReplyTarget | null;
  /** Set the reply target (undefined = replies unsupported, e.g. fixtures). */
  onReply?: (target: ReplyTarget | null) => void;
  /** Signed-in user id — lets you delete your own comments. */
  myUserId?: string | null;
  /** Post owner — can delete ANY comment on their post. */
  canModerate?: boolean;
  /** Delete a comment by id (undefined = deletion unsupported). */
  onDelete?: (commentId: string) => void;
  loading?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const router = useRouter();
  const dismissAndClose = () => {
    Keyboard.dismiss();
    onClose();
  };
  const openProfile = (handle: string) => {
    dismissAndClose();
    router.push(`/user/${handle.replace(/^@/, "")}`);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={dismissAndClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={StyleSheet.absoluteFill} onPress={dismissAndClose} accessibilityLabel="Close comments" />
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
          {/* Half-screen popup — the post stays visible behind it. */}
          <View
            style={{
              height: height * 0.5,
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
              <Pressable onPress={dismissAndClose} accessibilityLabel="Close" hitSlop={10} style={{ position: "absolute", right: 16, top: 10 }}>
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
                // Counteract the container's horizontal padding — the skeleton rows pad themselves.
                <View style={{ marginHorizontal: -18 }}>
                  <SkeletonCommentRow />
                  <SkeletonCommentRow />
                  <SkeletonCommentRow />
                </View>
              ) : comments.length === 0 ? (
                <Text style={{ fontSize: 13.5, color: colors.fog }}>No comments yet. Say something.</Text>
              ) : (
                comments
                  .filter((c) => !c.parentId)
                  .map((comment) => (
                    <View key={comment.id}>
                      <CommentLine comment={comment} onOpenProfile={openProfile} onReply={onReply} canDelete={Boolean(onDelete) && (canModerate || comment.userId === myUserId)} onDelete={onDelete} />
                      {comments
                        .filter((r) => r.parentId === comment.id)
                        .map((reply) => (
                          <View key={reply.id} style={{ paddingLeft: 44, paddingTop: 10 }}>
                            <CommentLine comment={reply} onOpenProfile={openProfile} onReply={onReply} replyParent={comment} canDelete={Boolean(onDelete) && (canModerate || reply.userId === myUserId)} onDelete={onDelete} />
                          </View>
                        ))}
                    </View>
                  ))
              )}
            </ScrollView>

            {/* Replying-to bar */}
            {replyTo ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 18, paddingTop: 8 }}>
                <Text style={{ flex: 1, fontSize: 12.5, color: colors.silver }}>
                  Replying to <Text style={{ fontFamily: "Geist_700Bold", color: colors.white }}>@{replyTo.handle}</Text>
                </Text>
                <Pressable onPress={() => onReply?.(null)} accessibilityLabel="Cancel reply" hitSlop={8}>
                  <X size={15} color={colors.fog} strokeWidth={2.2} />
                </Pressable>
              </View>
            ) : null}
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
                // Keyboard "send" posts immediately and keeps the keyboard up
                // for the next comment (IG-style) — no extra button press.
                submitBehavior="submit"
                placeholder="Add a comment…"
                placeholderTextColor={colors.ash}
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
                // onPressIn: fires on touch-down, BEFORE the keyboard-dismiss
                // can swallow the tap — kills the press-twice bug.
                onPressIn={onSubmit}
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
