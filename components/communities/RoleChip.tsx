import { Text, View } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Small role pill next to a member's name. Colored roles use their color for
 * border + text; uncolored roles (and the default role) render nothing unless
 * `showDefault` is set, so a plain member list stays quiet.
 */
export function RoleChip({
  role,
  legacyRole,
  showDefault = false
}: {
  role: { name: string; color: string | null; is_admin: boolean; is_default?: boolean } | null | undefined;
  /** Pre-roles `community_members.role` text, for rows without a role row. */
  legacyRole?: string;
  showDefault?: boolean;
}) {
  const name = role?.name ?? (legacyRole === "admin" ? "Admin" : null);
  if (!name) return null;
  if (role?.is_default && !showDefault) return null;
  const color = role?.color ?? (role?.is_admin || legacyRole === "admin" ? colors.gold : colors.silver);
  return (
    <View style={{ borderWidth: 1, borderColor: color, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: `${color}1F` }}>
      <Text numberOfLines={1} style={{ fontFamily: "Geist_700Bold", fontSize: 10, letterSpacing: 0.5, color, textTransform: "uppercase" }}>
        {name}
      </Text>
    </View>
  );
}
