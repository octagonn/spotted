import { PillBadge } from "@/components/communities/Badges";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/**
 * Small role pill next to a member's name. Colored roles use their color;
 * uncolored roles (and the default role) render nothing unless `showDefault`
 * is set, so a plain member list stays quiet.
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
  const color = role?.color ?? (role?.is_admin || legacyRole === "admin" ? tokens.accent.gold : colors.silver);
  return <PillBadge label={name} color={color} />;
}
