import { Check } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import {
  REPORT_REASONS,
  useReportContent,
  type ReportContentType
} from "@/hooks/queries/useContentModeration";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/** Report flow — pick a reason, submit. Backs App Store UGC moderation. */
export function ReportSheet({
  contentType,
  contentId,
  reportedUserId,
  label
}: {
  contentType: ReportContentType;
  contentId: string;
  reportedUserId?: string | null;
  /** e.g. "post", "story", "@user" — shown in the title. */
  label: string;
}) {
  const sheet = useSheet();
  const report = useReportContent();
  const [reason, setReason] = useState<string | null>(null);

  const submit = () => {
    if (!reason) return;
    report.mutate(
      { contentType, contentId, reportedUserId, reason },
      {
        onSuccess: () => {
          sheet.close();
          showToast("Thanks — we'll review this.");
        },
        onError: () => showToast("Couldn't submit the report — try again")
      }
    );
  };

  return (
    <View>
      <SheetTitle>{`Report ${label}`}</SheetTitle>
      <SheetSub>Tell us what's wrong. Reports are anonymous to the other person.</SheetSub>
      {REPORT_REASONS.map((r) => (
        <Pressable key={r} onPress={() => setReason(r)} accessibilityLabel={r}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 13 }}>
            <View
              style={{
                width: 22,
                height: 22,
                borderRadius: 11,
                borderWidth: reason === r ? 0 : 1.5,
                borderColor: colors.iron,
                backgroundColor: reason === r ? colors.white : "transparent",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              {reason === r ? <Check size={13} color={colors.black} strokeWidth={3} /> : null}
            </View>
            <Text style={{ fontFamily: "Geist_500Medium", fontSize: 14.5, color: colors.white }}>{r}</Text>
          </View>
        </Pressable>
      ))}
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Button disabled={!reason || report.isPending} loading={report.isPending} onPress={submit}>
          Submit report
        </Button>
      </View>
    </View>
  );
}
