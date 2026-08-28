import { Ban } from "lucide-react-native";

import { ModeratedAccountsScreen } from "@/components/settings/ModeratedAccountsScreen";
import { useBlockedAccounts, useUnblockUser } from "@/hooks/queries/useSafety";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/** Blocked accounts list (§5): photo, username, date; unblock w/ confirm. */
export default function BlockedAccountsScreen() {
  const blocked = useBlockedAccounts();
  const unblock = useUnblockUser();

  return (
    <ModeratedAccountsScreen
      title="Blocked accounts"
      data={blocked.data}
      isLoading={blocked.isLoading}
      emptyIcon={<Ban size={26} color={colors.slate} strokeWidth={2} />}
      emptyTitle="No blocked accounts"
      emptyBody="People you block will show up here."
      searchPlaceholder="Search blocked"
      rowSub={(r) => `@${r.username} · blocked ${new Date(r.since).toLocaleDateString()}`}
      actionLabel="Unblock"
      confirmTitle="Unblock?"
      confirmBody={(name) => `${name} will be able to find and message you again. This does not restore your friendship.`}
      onAction={(id) =>
        unblock.mutate(id, { onSuccess: () => showToast("Unblocked"), onError: () => showToast("Couldn't unblock — try again") })
      }
    />
  );
}
