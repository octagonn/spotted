import { useRouter } from "expo-router";
import { useState } from "react";
import { appAlert } from "@/components/ui/AppDialog";
import { Camera } from "lucide-react-native";
import { Modal, Pressable, Text, View } from "react-native";

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
  // Full-screen reaction photo (IG-style profile-picture zoom).
  const [zoomed, setZoomed] = useState<string | null>(null);

  const confirmRemove = () => {
    if (!postId) return;
    appAlert("Remove reaction", "Remove your reaction from this post?", [
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
      <Modal visible={Boolean(zoomed)} transparent animationType="fade" onRequestClose={() => setZoomed(null)} statusBarTranslucent>
        <Pressable
          onPress={() => setZoomed(null)}
          accessibilityLabel="Close reaction"
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.94)", alignItems: "center", justifyContent: "center", padding: 28 }}
        >
          <View style={{ width: "100%", aspectRatio: 1, maxWidth: 380, borderRadius: 24, overflow: "hidden", backgroundColor: colors.graphite }}>
            {zoomed ? <CachedImage source={{ uri: zoomed }} style={{ flex: 1 }} contentFit="cover" /> : null}
          </View>
        </Pressable>
      </Modal>
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
              // Left is WHO reacted (their profile picture); right is WHAT they
              // reacted with. Previously the selfie was rendered in both slots,
              // so the person's avatar never appeared at all.
              left={<Avatar name={r.name} uri={r.avatarUrl} size={46} />}
              name={r.mine ? `${r.name} (you)` : r.name}
              sub={r.mine ? "Hold to remove" : `@${r.username}`}
              onLongPress={r.mine ? confirmRemove : undefined}
              right={
                r.mediaUrl ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Camera size={14} color={colors.fog} strokeWidth={2} />
                    {/* Tap to enlarge, like opening a profile picture. Stops
                        propagation so it doesn't also open the profile. */}
                    <Pressable
                      onPress={() => setZoomed(r.mediaUrl)}
                      accessibilityLabel={`View ${r.name}'s reaction`}
                      hitSlop={6}
                    >
                      <CachedImage
                        source={{ uri: r.mediaUrl }}
                        style={{ width: 45, height: 45, borderRadius: 10 }}
                        contentFit="cover"
                      />
                    </Pressable>
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
