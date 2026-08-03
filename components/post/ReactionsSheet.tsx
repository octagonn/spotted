import { useRouter } from "expo-router";
import { Camera } from "lucide-react-native";
import { Alert, Text, View } from "react-native";

import { Avatar } from "@/components/ui/Avatar";
import { CachedImage } from "@/components/ui/CachedImage";
import { ListRow } from "@/components/ui/ListRow";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { useRemoveReaction, type ReactionSelfie } from "@/hooks/queries/usePostReactionSelfies";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/** Bottom-sheet list of everyone who live-reacted to a post — tap to open a profile. */
export function ReactionsSheet({ reactors, postId }: { reactors: ReactionSelfie[]; postId?: string }) {
  const router = useRouter();
  const sheet = useSheet();
  const removeReaction = useRemoveReaction();

  const confirmRemove = () => {
    if (!postId) return;
    Alert.alert("Remove reaction", "Remove your reaction from this post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () =>
          removeReaction.mutate(
            { postId },
            { onError: () => showToast("Couldn't remove your reaction — try again") }
          )
      }
    ]);
  };
  return (
    <View>
      <SheetTitle>Reactions</SheetTitle>
      <SheetSub>{`${reactors.length} ${reactors.length === 1 ? "person" : "people"} reacted`}</SheetSub>
      {reactors.length === 0 ? (
        <Text style={{ paddingHorizontal: 20, paddingVertical: 16, fontSize: 12.5, color: colors.fog }}>
          No reactions yet.
        </Text>
      ) : (
        reactors.map((r) => {
          const openProfile = () => {
            sheet.close();
            router.push(`/user/${r.username}`);
          };
          const row = (
            <ListRow
              key={r.userId}
              left={
                r.mediaUrl ? (
                  <CachedImage source={{ uri: r.mediaUrl }} style={{ width: 46, height: 46, borderRadius: 23 }} contentFit="cover" />
                ) : (
                  <Avatar name={r.name} uri={r.avatarUrl} size={46} />
                )
              }
              name={r.mine ? `${r.name} (you)` : r.name}
              sub={r.mine ? "Hold to remove" : `@${r.username}`}
              onLongPress={r.mine ? confirmRemove : undefined}
              right={
                // Live reactions are selfie-only — show the shot they reacted with.
                r.mediaUrl ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Camera size={14} color={colors.fog} strokeWidth={2} />
                    <CachedImage source={{ uri: r.mediaUrl }} style={{ width: 30, height: 30, borderRadius: 8 }} contentFit="cover" />
                  </View>
                ) : undefined
              }
              onPress={openProfile}
            />
          );
          // Your own reaction: long-press-to-remove isn't discoverable to a
          // screen reader, so expose an explicit "Remove reaction" action
          // (WCAG 2.5.1). The wrapper keeps tap-to-open-profile via a11y tap.
          if (r.mine) {
            return (
              <View
                key={r.userId}
                accessible
                accessibilityRole="button"
                accessibilityLabel={`${r.name} (you), reacted`}
                onAccessibilityTap={openProfile}
                accessibilityActions={[{ name: "remove", label: "Remove reaction" }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === "remove") confirmRemove();
                }}
              >
                {row}
              </View>
            );
          }
          return row;
        })
      )}
    </View>
  );
}
