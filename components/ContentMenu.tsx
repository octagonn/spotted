import { useQueryClient } from "@tanstack/react-query";
import { Ban, CirclePlus, Flag, Send, Trash2, UserMinus } from "lucide-react-native";
import { View } from "react-native";

import { ReportSheet } from "@/components/ReportSheet";
import { ShareToFriendSheet } from "@/components/friends/ShareToFriendSheet";
import { ConfirmSheet, MenuRow } from "@/components/ui/MenuRow";
import { SheetTitle, useSheet } from "@/components/ui/Sheet";
import { type ReportContentType } from "@/hooks/queries/useContentModeration";
import { type ShareKind } from "@/hooks/queries/useMessagesExtras";
import { useBlockUser } from "@/hooks/queries/useSafety";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/**
 * The action sheet behind the kebab (⋯) on posts and stories. On your own
 * content it offers Delete (with a confirm step); on someone else's it offers
 * Report. Pass `onDelete` only for content you own.
 */
export function ContentMenu({
  contentType,
  contentId,
  reportLabel,
  reportedUserId,
  onDelete,
  share,
  onAddToStory,
  onRemoveFriend
}: {
  contentType: ReportContentType;
  contentId: string;
  reportLabel: string;
  reportedUserId?: string | null;
  /** Provided only when the content is the viewer's own. */
  onDelete?: () => void;
  /** When set, adds a "Send to a friend" row (#8 in-app share). */
  share?: { kind: ShareKind; id: string; label: string };
  /** When set, adds "Add to your story" (posts the viewer is tagged in). */
  onAddToStory?: () => void;
  /** When set (viewing a friend's profile), adds "Remove friend". */
  onRemoveFriend?: () => void;
}) {
  const sheet = useSheet();
  const queryClient = useQueryClient();
  const blockUser = useBlockUser();

  // Partner ask: blocking used to be reachable only from a DM thread — a bad
  // post in the public feed had no path to block its author.
  const confirmBlock = () => {
    if (!reportedUserId) return;
    sheet.open(
      <ConfirmSheet
        title="Block this account?"
        body="They won't see your posts or profile, and you won't see theirs. They aren't notified. You can unblock in Settings → Blocked."
        confirmLabel="Block"
        confirmIcon={<Ban size={18} color="#EF4444" strokeWidth={2} />}
        onConfirm={() => {
          blockUser.mutate(reportedUserId, {
            onSuccess: () => {
              showToast("Blocked");
              // Their content disappears everywhere without a manual refresh.
              void queryClient.invalidateQueries({ queryKey: ["feed"] });
              void queryClient.invalidateQueries({ queryKey: ["stories"] });
            }
          });
        }}
      />
    );
  };

  const confirmDelete = () => {
    sheet.open(
      <ConfirmSheet
        title={`Delete this ${contentType}?`}
        body="This can't be undone. It'll be removed for everyone."
        confirmLabel="Delete"
        confirmIcon={<Trash2 size={18} color="#EF4444" strokeWidth={2} />}
        onConfirm={() => onDelete?.()}
      />
    );
  };

  return (
    <View>
      <SheetTitle>Options</SheetTitle>
      {onAddToStory ? (
        <MenuRow
          icon={<CirclePlus size={18} color={colors.silver} strokeWidth={2} />}
          label="Add to your story"
          onPress={() => {
            sheet.close();
            onAddToStory();
          }}
        />
      ) : null}
      {share ? (
        <MenuRow
          icon={<Send size={18} color={colors.silver} strokeWidth={2} />}
          label="Send to a friend"
          onPress={() => sheet.open(<ShareToFriendSheet sharedKind={share.kind} sharedId={share.id} label={share.label} />)}
        />
      ) : null}
      {onDelete ? (
        <MenuRow icon={<Trash2 size={18} color="#EF4444" strokeWidth={2} />} label="Delete" destructive onPress={confirmDelete} />
      ) : (
        <>
          <MenuRow
            icon={<Flag size={18} color={colors.silver} strokeWidth={2} />}
            label="Report"
            onPress={() =>
              sheet.open(
                <ReportSheet contentType={contentType} contentId={contentId} reportedUserId={reportedUserId} label={reportLabel} />
              )
            }
          />
          {onRemoveFriend ? (
            <MenuRow
              icon={<UserMinus size={18} color={colors.silver} strokeWidth={2} />}
              label="Remove friend"
              onPress={() =>
                sheet.open(
                  <ConfirmSheet
                    title="Remove friend?"
                    body="You'll stop seeing each other's private posts and streaks. They aren't notified, and you can add each other again any time."
                    confirmLabel="Remove"
                    confirmIcon={<UserMinus size={18} color="#EF4444" strokeWidth={2} />}
                    onConfirm={onRemoveFriend}
                  />
                )
              }
            />
          ) : null}
          {reportedUserId ? (
            <MenuRow icon={<Ban size={18} color="#EF4444" strokeWidth={2} />} label="Block account" destructive onPress={confirmBlock} />
          ) : null}
        </>
      )}
      <MenuRow icon={null} label="Cancel" onPress={() => sheet.close()} />
      <View style={{ height: 8 }} />
    </View>
  );
}
