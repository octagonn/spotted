import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Check, Play } from "lucide-react-native";
import { useCallback, useState } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";

import { appAlert } from "@/components/ui/AppDialog";
import { Button } from "@/components/ui/Button";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { deleteCameraDrafts, loadCameraDrafts, requestDraftResume, type CameraDraft } from "@/lib/cameraDraft";
import { useAuthStore } from "@/stores/auth";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

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

  const cellW = Math.floor((winW - 16 * 2 - 2 * 2) / 3);

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
    appAlert(
      count === 1 ? "Delete this draft?" : `Delete ${count} drafts?`,
      "This can't be undone.",
      [
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
      ]
    );
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
              hitSlop={8}
            >
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: colors.white, paddingHorizontal: 4 }}>
                {selecting ? "Cancel" : "Select"}
              </Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 96 }}>
        {drafts === null ? null : drafts.length === 0 ? (
          <Text style={{ paddingTop: 60, textAlign: "center", fontSize: 13, color: colors.fog, paddingHorizontal: 24 }}>
            No drafts. Save one from the post details page and it'll be here.
          </Text>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
            {drafts.map((draft) => {
              const isSelected = selected.has(draft.id);
              return (
                <Pressable
                  key={draft.id}
                  accessibilityLabel={selecting ? `${isSelected ? "Deselect" : "Select"} draft` : "Open draft"}
                  onPress={() => (selecting ? toggleSelect(draft.id) : openDraft(draft))}
                  haptic={false}
                >
                  <View style={{ width: cellW, height: Math.round(cellW * 1.25), borderRadius: 8, overflow: "hidden", backgroundColor: colors.graphite }}>
                    {draft.photoUri ? (
                      <Image source={{ uri: draft.photoUri }} contentFit="cover" style={{ flex: 1 }} transition={80} />
                    ) : (
                      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" }}>
                          <Play size={15} color={colors.white} fill={colors.white} strokeWidth={0} />
                        </View>
                      </View>
                    )}
                    {/* Mode badge so lift videos and daily posts read apart. */}
                    {draft.mode === "lift" ? (
                      <View style={{ position: "absolute", left: 6, bottom: 6, borderRadius: 6, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 9, letterSpacing: 1, color: colors.white }}>LIFT</Text>
                      </View>
                    ) : null}
                    {selecting ? (
                      <View
                        style={{
                          position: "absolute",
                          top: 6,
                          right: 6,
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 1.5,
                          borderColor: isSelected ? colors.white : "rgba(255,255,255,0.7)",
                          backgroundColor: isSelected ? colors.white : "rgba(0,0,0,0.35)",
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
        <View style={{ position: "absolute", left: 20, right: 20, bottom: insets.bottom + 16 }}>
          <Button onPress={confirmDelete} disabled={selected.size === 0 || deleting}>
            {deleting ? "Deleting…" : selected.size ? `Delete ${selected.size}` : "Delete"}
          </Button>
        </View>
      ) : null}
    </View>
  );
}
