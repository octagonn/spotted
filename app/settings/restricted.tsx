import { UserMinus } from "lucide-react-native";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Avatar } from "@/components/ui/Avatar";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { useRestrictedAccounts, useUnrestrictUser } from "@/hooks/queries/useSafety";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/** Restricted accounts list (§6): silent mute; unrestrict w/ confirm. */
export default function RestrictedAccountsScreen() {
  const insets = useSafeAreaInsets();
  const restricted = useRestrictedAccounts();
  const unrestrict = useUnrestrictUser();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = restricted.data ?? [];
    const query = q.trim().toLowerCase();
    if (!query) return list;
    return list.filter((r) => `${r.displayName} ${r.username}`.toLowerCase().includes(query));
  }, [restricted.data, q]);

  const confirmUnrestrict = (id: string, name: string) => {
    Alert.alert("Unrestrict?", `${name}'s messages and taunts will reach you normally again.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unrestrict",
        onPress: () => unrestrict.mutate(id, { onSuccess: () => showToast("Unrestricted"), onError: () => showToast("Couldn't update — try again") })
      }
    ]);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Restricted accounts" />
      {restricted.isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : (restricted.data ?? []).length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 44, paddingBottom: 80 }}>
          <UserMinus size={26} color={colors.slate} strokeWidth={2} />
          <Text style={{ marginTop: 14, fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>No restricted accounts</Text>
          <Text style={{ marginTop: 6, fontSize: 12.5, color: colors.fog, textAlign: "center" }}>
            Restricting quietly mutes someone&apos;s taunts and filters their messages — they&apos;re never told.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {(restricted.data ?? []).length > 20 ? (
            <SearchBar value={q} onChangeText={setQ} placeholder="Search restricted" containerStyle={{ marginHorizontal: 18, marginTop: 4, marginBottom: 8 }} />
          ) : null}
          {rows.map((r) => (
            <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 18 }}>
              <Avatar name={r.displayName} uri={r.avatarUrl} size={46} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>{r.displayName}</Text>
                <Text style={{ marginTop: 2, fontSize: 12, color: colors.fog }}>@{r.username}</Text>
              </View>
              <Pressable onPress={() => confirmUnrestrict(r.id, r.displayName)} accessibilityLabel={`Unrestrict ${r.displayName}`}>
                <View style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.slate }}>
                  <Text style={{ fontSize: 12.5, fontFamily: "Geist_600SemiBold", color: colors.white }}>Unrestrict</Text>
                </View>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
