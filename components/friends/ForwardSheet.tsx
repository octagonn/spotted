import { PickFriendSheet } from "@/components/friends/PickFriendSheet";
import { useForwardMessage } from "@/hooks/queries/useMessagesExtras";

/**
 * Forward a message to a mutual friend (#14). Only the current user's friends
 * are listed. Selecting a friend forwards immediately.
 */
export function ForwardSheet({ content }: { content: string }) {
  const forward = useForwardMessage();
  return (
    <PickFriendSheet
      title="Forward to"
      sub="Send this message to a friend."
      emptyText="Add friends to forward messages."
      successToast={(name) => `Forwarded to ${name}`}
      errorToast="Couldn't forward — try again"
      send={(friendId, callbacks) => forward.mutate({ targetUserId: friendId, content }, callbacks)}
    />
  );
}
