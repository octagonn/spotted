import { Ban } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { useBlockedAccounts, useUnblockUser } from "@/hooks/queries/useSafety";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/** Blocked accounts list (§5): photo, username, date; unblock w/ confirm. */
export default function BlockedAccountsScreen() {
  const insets = useSafeAreaInsets();
  const blocked = useBlockedAccounts();
  const unblock = useUnblockUser();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = blocked.data ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((r) => `${r.displayName} ${r.username}`.toLowerCase().includes(query));
  }, [blocked.data, q]);

  const confirmUnblock = (id: string, name: string) => {
    Alert.alert("Unblock?", `${name} will be able to find and message you again. This does not restore your friendship.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        onPress: () => unblock.mutate(id, { onSuccess: () => showToast("Unblocked"), onError: () => showToast("Couldn't unblock — try again") })
      }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Blocked accounts" />
      {blocked.isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : (blocked.data ?? []).length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 44, paddingBottom: 80 }}>
          <Ban size={26} color={colors.slate} strokeWidth={2} />
          <Text style={{ marginTop: 14, fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>No blocked accounts</Text>
          <Text style={{ marginTop: 6, fontSize: 12.5, color: colors.fog, textAlign: "center" }}>People you block will show up here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {(blocked.data ?? []).length > 20 ? (
            <SearchBar value={q} onChangeText={setQ} placeholder="Search blocked" containerStyle={{ marginHorizontal: 18, marginTop: 4, marginBottom: 8 }} />
          ) : null}
          {rows.map((r) => (
            <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 18 }}>
              <Avatar name={r.displayName} uri={r.avatarUrl} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>{r.displayName}</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: colors.fog }}>
                  @{r.username} · blocked {new Date(r.since).toLocaleDateString()}
                </Text>
              </View>
              <Pressable onPress={() => confirmUnblock(r.id, r.displayName)} accessibilityLabel={`Unblock ${r.displayName}`}>
                <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.slate }}>
                  <Text style={{ fontSize: 12.5, fontFamily: "Geist_600SemiBold", color: colors.white }}>Unblock</Text>
                </View>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
