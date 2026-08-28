import { PickFriendSheet } from "@/components/friends/PickFriendSheet";
import { useShareToMessage, type ShareKind } from "@/hooks/queries/useMessagesExtras";

/**
 * Share an in-app item (post / check-in / stream / workout) into a DM (#8).
 * Only mutual friends are listed. Reusable from any screen that can produce a
 * (sharedKind, sharedId, label).
 */
export function ShareToFriendSheet({
  sharedKind,
  sharedId,
  label
}: {
  sharedKind: ShareKind;
  sharedId: string;
  label: string;
}) {
  const share = useShareToMessage();
  return (
    <PickFriendSheet
      title="Send to"
      sub="Share this with a friend."
      emptyText="Add friends to share with them."
      successToast={(name) => `Sent to ${name}`}
      errorToast="Couldn't send — try again"
      send={(friendId, callbacks) => share.mutate({ targetUserId: friendId, sharedKind, sharedId, label }, callbacks)}
    />
  );
}
