import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/AppDialog";
import { Avatar } from "@/components/ui/Avatar";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { colors } from "@/theme/colors";

type ModeratedRow = { id: string; displayName: string; username: string; avatarUrl: string | null };

/**
 * Shared scaffold for the Blocked / Restricted settings lists — the two
 * screens are the same UI down to the pill button; only the hook, icon, and
 * strings differ, so those come in as props. Search bar appears past 20 rows.
 */
export function ModeratedAccountsScreen<T extends ModeratedRow>({
  title,
  data,
  isLoading,
  emptyIcon,
  emptyTitle,
  emptyBody,
  searchPlaceholder,
  rowSub,
  actionLabel,
  confirmTitle,
  confirmBody,
  onAction
}: {
  title: string;
  data: T[] | undefined;
  isLoading: boolean;
  emptyIcon: React.ReactNode;
  emptyTitle: string;
  emptyBody: string;
  searchPlaceholder: string;
  /** Second line under the display name (handle, dates, …). */
  rowSub: (row: T) => string;
  /** Pill + confirm-button label ("Unblock" / "Unrestrict"). */
  actionLabel: string;
  confirmTitle: string;
  confirmBody: (name: string) => string;
  /** Fires after the user confirms; caller owns the mutation + toasts. */
  onAction: (id: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = data ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((r) => `${r.displayName} ${r.username}`.toLowerCase().includes(query));
  }, [data, q]);

  const confirm = (id: string, name: string) => {
    appAlert(confirmTitle, confirmBody(name), [
      { text: "Cancel", style: "cancel" },
      { text: actionLabel, onPress: () => onAction(id) }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title={title} />
      {isLoading ? (
        <SkeletonRows count={4} />
      ) : (data ?? []).length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 44, paddingBottom: 80 }}>
          {emptyIcon}
          <Text style={{ marginTop: 14, fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>{emptyTitle}</Text>
          <Text style={{ marginTop: 6, fontSize: 12.5, color: colors.fog, textAlign: "center" }}>{emptyBody}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {(data ?? []).length > 20 ? (
            <SearchBar value={q} onChangeText={setQ} placeholder={searchPlaceholder} containerStyle={{ marginHorizontal: 18, marginTop: 4, marginBottom: 8 }} />
          ) : null}
          {rows.map((r) => (
            <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 18 }}>
              <Avatar name={r.displayName} uri={r.avatarUrl} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>{r.displayName}</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: colors.fog }}>{rowSub(r)}</Text>
              </View>
              <Pressable onPress={() => confirm(r.id, r.displayName)} accessibilityLabel={`${actionLabel} ${r.displayName}`}>
                <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.slate }}>
                  <Text style={{ fontSize: 12.5, fontFamily: "Geist_600SemiBold", color: colors.white }}>{actionLabel}</Text>
                </View>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
