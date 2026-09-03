import { useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { appAlert } from "@/components/ui/AppDialog";
import { RelButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { UserRow } from "@/components/ui/UserRow";
import { colors } from "@/theme/colors";
import { space } from "@/theme/tokens";

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
        <EmptyState center icon={emptyIcon} title={emptyTitle} body={emptyBody} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space[6] }}>
          {(data ?? []).length > 20 ? (
            <SearchBar
              value={q}
              onChangeText={setQ}
              placeholder={searchPlaceholder}
              containerStyle={{ marginHorizontal: space[4], marginTop: space[1], marginBottom: space[2] }}
            />
          ) : null}
          {rows.map((r) => (
            <UserRow
              key={r.id}
              name={r.displayName}
              avatarUrl={r.avatarUrl}
              sub={rowSub(r)}
              right={<RelButton label={actionLabel} kind="ghost" onPress={() => confirm(r.id, r.displayName)} />}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
