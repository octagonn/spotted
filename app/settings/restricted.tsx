import { UserMinus } from "lucide-react-native";

import { ModeratedAccountsScreen } from "@/components/settings/ModeratedAccountsScreen";
import { useRestrictedAccounts, useUnrestrictUser } from "@/hooks/queries/useSafety";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/** Restricted accounts list (§6): silent mute; unrestrict w/ confirm. */
export default function RestrictedAccountsScreen() {
  const restricted = useRestrictedAccounts();
  const unrestrict = useUnrestrictUser();

  return (
    <ModeratedAccountsScreen
      title="Restricted accounts"
      data={restricted.data}
      isLoading={restricted.isLoading}
      emptyIcon={<UserMinus size={26} color={colors.slate} strokeWidth={2} />}
      emptyTitle="No restricted accounts"
      emptyBody="Restricting quietly mutes someone's taunts and filters their messages — they're never told."
      searchPlaceholder="Search restricted"
      rowSub={(r) => `@${r.username}`}
      actionLabel="Unrestrict"
      confirmTitle="Unrestrict?"
      confirmBody={(name) => `${name}'s messages and taunts will reach you normally again.`}
      onAction={(id) =>
        unrestrict.mutate(id, {
          onSuccess: () => showToast("Unrestricted"),
          onError: () => showToast("Couldn't update — try again")
        })
      }
    />
  );
}
