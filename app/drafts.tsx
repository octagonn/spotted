import { useFocusEffect } from "@react-navigation/native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Check, Play } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { EMPTY_ART } from "@/lib/emptyStateArt";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { deleteCameraDrafts, loadCameraDrafts, requestDraftResume, type CameraDraft } from "@/lib/cameraDraft";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

/**
 * Drafts gallery (IG-style): a grid of saved-post previews. Tap one to open
 * it back into the camera flow; "Select" (top right) switches to multi-select
 * for deleting.
 */
export default function DraftsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const userId = useAuthStore((state) => state.userId);

  const [drafts, setDrafts] = useState<CameraDraft[] | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const reload = useCallback(() => {
    void loadCameraDrafts(userId).then(setDrafts);
  }, [userId]);
  useFocusEffect(reload);

  const cellW = Math.floor((winW - space[4] * 2 - 2 * 2) / 3);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openDraft = (draft: CameraDraft) => {
    // Hand the id back to the camera screen below us — it consumes it on focus.
    requestDraftResume(draft.id);
    router.back();
  };

  const confirmDelete = () => {
    const count = selected.size;
    if (count === 0 || deleting) return;
    appAlert(count === 1 ? "Delete this draft?" : `Delete ${count} drafts?`, "This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          setDeleting(true);
          void deleteCameraDrafts(userId, [...selected]).then(() => {
            setDeleting(false);
            setSelected(new Set());
            setSelecting(false);
            showToast(count === 1 ? "Draft deleted" : `${count} drafts deleted`);
            reload();
          });
        }
      }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader
        title="Drafts"
        sub={drafts?.length ? `${drafts.length} saved` : undefined}
        right={
          (drafts?.length ?? 0) > 0 ? (
            <Pressable
              accessibilityLabel={selecting ? "Cancel selection" : "Select drafts"}
              onPress={() => {
                setSelecting((v) => !v);
                setSelected(new Set());
              }}
              haptic="selection"
              hitSlop={8}
            >
              <Text variant="meta-strong" className="px-1 text-white">
                {selecting ? "Cancel" : "Select"}
              </Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: insets.bottom + space[12] * 2 }}>
        {drafts === null ? null : drafts.length === 0 ? (
          <EmptyState
            art={EMPTY_ART.photos}
            title="No drafts"
            body="Save one from the post details page and it'll be here."
          />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
            {drafts.map((draft) => {
              const isSelected = selected.has(draft.id);
              return (
                <Pressable
                  key={draft.id}
                  accessibilityLabel={selecting ? `${isSelected ? "Deselect" : "Select"} draft` : "Open draft"}
                  onPress={() => (selecting ? toggleSelect(draft.id) : openDraft(draft))}
                  haptic={selecting ? "selection" : "none"}
                >
                  <View
                    style={{
                      width: cellW,
                      height: Math.round(cellW * 1.25),
                      borderRadius: radius.sm / 1.5,
                      overflow: "hidden",
                      backgroundColor: colors.graphite
                    }}
                  >
                    {draft.photoUri ? (
                      <Image source={{ uri: draft.photoUri }} contentFit="cover" style={{ flex: 1 }} transition={80} />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <View
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: 17,
                            backgroundColor: colors.hairlineStrong,
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                        >
                          <Play size={icon.size.xs - 1} color={colors.white} fill={colors.white} strokeWidth={0} />
                        </View>
                      </View>
                    )}
                    {/* Mode badge so lift videos and daily posts read apart. */}
                    {draft.mode === "lift" ? (
                      <View
                        style={{
                          position: "absolute",
                          left: space[1] + 2,
                          bottom: space[1] + 2,
                          borderRadius: radius.sm / 2,
                          backgroundColor: tokens.bg.scrim,
                          paddingHorizontal: space[1] + 2,
                          paddingVertical: 2
                        }}
                      >
                        <Text variant="micro" className="text-white">
                          Lift
                        </Text>
                      </View>
                    ) : null}
                    {selecting ? (
                      <View
                        style={{
                          position: "absolute",
                          top: space[1] + 2,
                          right: space[1] + 2,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 1.5,
                          borderColor: colors.white,
                          backgroundColor: isSelected ? colors.white : tokens.bg.scrim,
                          alignItems: "center",
                          justifyContent: "center"
                        }}
                      >
                        {isSelected ? <Check size={12} color={colors.black} strokeWidth={3} /> : null}
                      </View>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      {selecting ? (
        <View
          style={{ position: "absolute", left: space[4] + 4, right: space[4] + 4, bottom: insets.bottom + space[4] }}
        >
          <Button
            variant="danger-solid"
            onPress={confirmDelete}
            loading={deleting}
            disabled={selected.size === 0 || deleting}
          >
            {selected.size ? `Delete ${selected.size}` : "Delete"}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
