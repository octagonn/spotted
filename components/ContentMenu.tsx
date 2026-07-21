import { Flag, Send, Trash2 } from "lucide-react-native";
import { Text, View } from "react-native";

import { ReportSheet } from "@/components/ReportSheet";
import { ShareToFriendSheet } from "@/components/friends/ShareToFriendSheet";
import { Pressable } from "@/components/ui/Pressable";
import { SheetTitle, useSheet } from "@/components/ui/Sheet";
import { type ReportContentType } from "@/hooks/queries/useContentModeration";
import { type ShareKind } from "@/hooks/queries/useMessagesExtras";
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
  share
}: {
  contentType: ReportContentType;
  contentId: string;
  reportLabel: string;
  reportedUserId?: string | null;
  /** Provided only when the content is the viewer's own. */
  onDelete?: () => void;
  /** When set, adds a "Send to a friend" row (#8 in-app share). */
  share?: { kind: ShareKind; id: string; label: string };
}) {
  const sheet = useSheet();

  const confirmDelete = () => {
    sheet.open(
      <View>
        <SheetTitle>{`Delete this ${contentType}?`}</SheetTitle>
        <Text style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 10, fontSize: 13, lineHeight: 19, color: colors.silver }}>
          This can't be undone. It'll be removed for everyone.
        </Text>
        <Row
          icon={<Trash2 size={18} color="#EF4444" strokeWidth={2} />}
          label="Delete"
          destructive
          onPress={() => {
            sheet.close();
            onDelete?.();
          }}
        />
        <Row icon={null} label="Cancel" onPress={() => sheet.close()} />
        <View style={{ height: 8 }} />
      </View>
    );
  };

  return (
    <View>
      <SheetTitle>Options</SheetTitle>
      {share ? (
        <Row
          icon={<Send size={18} color={colors.silver} strokeWidth={2} />}
          label="Send to a friend"
          onPress={() => sheet.open(<ShareToFriendSheet sharedKind={share.kind} sharedId={share.id} label={share.label} />)}
        />
      ) : null}
      {onDelete ? (
        <Row icon={<Trash2 size={18} color="#EF4444" strokeWidth={2} />} label="Delete" destructive onPress={confirmDelete} />
      ) : (
        <Row
          icon={<Flag size={18} color={colors.silver} strokeWidth={2} />}
          label="Report"
          onPress={() =>
            sheet.open(
              <ReportSheet contentType={contentType} contentId={contentId} reportedUserId={reportedUserId} label={reportLabel} />
            )
          }
        />
      )}
      <Row icon={null} label="Cancel" onPress={() => sheet.close()} />
      <View style={{ height: 8 }} />
    </View>
  );
}

function Row({
  icon,
  label,
  destructive,
  onPress
}: {
  icon: React.ReactNode;
  label: string;
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} accessibilityLabel={label}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 15 }}>
        <View style={{ width: 20, alignItems: "center" }}>{icon}</View>
        <Text
          style={{
            fontFamily: "Geist_600SemiBold",
            fontSize: 15,
            color: destructive ? "#EF4444" : label === "Cancel" ? colors.fog : colors.white
          }}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}
