import { useVideoPlayer, VideoView } from "expo-video";
import { Check, X } from "lucide-react-native";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import {
  REJECTION_REASONS,
  useIsAdmin,
  usePendingClaims,
  useReviewClaim,
  type PendingClaim
} from "@/hooks/queries/useTrophyClaims";
import { LIFT_OPTION_BY_ID } from "@/lib/liftCatalog";
import { relDay } from "@/lib/relDay";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/**
 * Lift-claim review queue (spec D admin tool). Admins see each pending claim's
 * video, claimed trophy + weight, and approve/reject with canned reasons.
 * Approval fires the trophy unlock + logs the lift; rejection notifies the
 * user with the reason so they can resubmit.
 */
export default function AdminClaimsScreen() {
  const insets = useSafeAreaInsets();
  const isAdmin = useIsAdmin();
  const claims = usePendingClaims(isAdmin.data === true);

  if (isAdmin.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.white} />
      </View>
    );
  }
  if (!isAdmin.data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title="Claim review" />
        <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
          You don&apos;t have review access.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Claim review" sub={`${claims.data?.length ?? 0} pending`} />
      {claims.isLoading ? (
        <View style={{ paddingTop: 40, alignItems: "center" }}>
          <ActivityIndicator color={colors.mist} />
        </View>
      ) : (claims.data ?? []).length === 0 ? (
        <Text style={{ paddingTop: 40, textAlign: "center", fontSize: 13, color: colors.fog }}>
          Nothing to review. Queue&apos;s clear 🎉
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24, gap: 16 }}>
          {(claims.data ?? []).map((claim) => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function ClaimCard({ claim }: { claim: PendingClaim }) {
  const review = useReviewClaim();
  const option = LIFT_OPTION_BY_ID[claim.trophyId as keyof typeof LIFT_OPTION_BY_ID];
  const unit = option?.unit ?? "lb";
  const player = useVideoPlayer(claim.videoUrl ? { uri: claim.videoUrl } : null, (p) => {
    p.loop = true;
    p.muted = true;
  });

  const approve = () =>
    review.mutate(
      { claimId: claim.id, approve: true },
      { onSuccess: () => showToast("Approved — trophy unlocked"), onError: () => showToast("Couldn't approve") }
    );
  const reject = (reasonId: string) =>
    review.mutate(
      { claimId: claim.id, approve: false, reasonId },
      { onSuccess: () => showToast("Rejected — user notified"), onError: () => showToast("Couldn't reject") }
    );

  return (
    <View style={{ borderWidth: 1, borderColor: colors.iron, borderRadius: 16, backgroundColor: colors.graphite, overflow: "hidden" }}>
      {claim.videoUrl ? (
        <View style={{ aspectRatio: 3 / 3.6, backgroundColor: colors.charcoal }}>
          <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls />
        </View>
      ) : (
        <View style={{ aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center", backgroundColor: colors.charcoal }}>
          <Text style={{ fontSize: 12, color: colors.fog }}>No video attached</Text>
        </View>
      )}
      <View style={{ padding: 14 }}>
        <Text style={{ fontFamily: "Geist_700Bold", fontSize: 16, color: colors.white }}>
          {option?.name ?? claim.trophyId} · {claim.claimedValue} {unit}
        </Text>
        <Text style={{ marginTop: 2, fontSize: 12.5, color: colors.fog }}>
          @{claim.username} · {relDay(claim.createdAt)}
        </Text>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <Pressable onPress={approve} disabled={review.isPending} style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 12, backgroundColor: colors.gold }}>
              <Check size={17} color={colors.black} strokeWidth={2.6} />
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Approve</Text>
            </View>
          </Pressable>
        </View>

        <Text style={{ marginTop: 16, marginBottom: 8, fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", color: colors.fog }}>
          Reject with reason
        </Text>
        <View style={{ gap: 8 }}>
          {REJECTION_REASONS.map((reason) => (
            <Pressable key={reason.id} onPress={() => reject(reason.id)} disabled={review.isPending}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.iron }}>
                <X size={14} color="#FF5C5C" strokeWidth={2.4} />
                <Text style={{ fontFamily: "Geist_500Medium", fontSize: 13.5, color: colors.bone }}>{reason.label}</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}
