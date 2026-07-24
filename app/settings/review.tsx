import { Image } from "expo-image";
import { ShieldCheck } from "lucide-react-native";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { useIsAdmin, useReviewQueue, useReviewResolve } from "@/hooks/queries/useModeration";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

/**
 * Admin moderation review queue. Flagged (borderline NSFW) posts land here;
 * approve restores them to the feed, remove deletes the post + media. Gated to
 * app_admins — non-admins see an empty guard.
 */
export default function ReviewQueueScreen() {
  const insets = useSafeAreaInsets();
  const isAdmin = useIsAdmin();
  const queue = useReviewQueue(isAdmin.data === true);
  const resolve = useReviewResolve();

  if (isAdmin.data === false) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title="Review queue" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <ShieldCheck size={26} color={colors.slate} strokeWidth={2} />
          <Text style={{ marginTop: 14, fontSize: 13, color: colors.fog, textAlign: "center" }}>
            Admins only.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Review queue" sub={queue.data ? `${queue.data.length} flagged` : undefined} />
      {queue.isLoading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : (queue.data ?? []).length === 0 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40 }}>
          <ShieldCheck size={26} color={colors.slate} strokeWidth={2} />
          <Text style={{ marginTop: 14, fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>Queue clear</Text>
          <Text style={{ marginTop: 6, fontSize: 12.5, color: colors.fog, textAlign: "center" }}>Nothing awaiting review.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 24 }}>
          {(queue.data ?? []).map((item) => (
            <View key={item.postId} style={{ borderRadius: 16, borderWidth: 1, borderColor: colors.iron, overflow: "hidden", backgroundColor: colors.ink }}>
              <View style={{ aspectRatio: 3 / 3.6, backgroundColor: colors.graphite }}>
                {item.mediaUrl ? <Image source={{ uri: item.mediaUrl }} contentFit="cover" style={{ flex: 1 }} /> : null}
                {item.insetUrl ? (
                  <View style={{ position: "absolute", top: 12, left: 12, width: "30%", aspectRatio: 3 / 4, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: colors.black }}>
                    <Image source={{ uri: item.insetUrl }} contentFit="cover" style={{ flex: 1 }} />
                  </View>
                ) : null}
                <View style={{ position: "absolute", bottom: 10, right: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.7)" }}>
                  <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 11, color: colors.white }}>
                    nsfw {item.score != null ? `${Math.round(item.score * 100)}%` : "?"}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, padding: 12 }}>
                <Pressable
                  onPress={() => resolve.mutate({ postId: item.postId, approve: true }, { onSuccess: () => showToast("Approved") })}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 999, borderWidth: 1, borderColor: colors.slate, alignItems: "center" }}
                >
                  <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13.5, color: colors.white }}>Approve</Text>
                </Pressable>
                <Pressable
                  onPress={() => resolve.mutate({ postId: item.postId, approve: false }, { onSuccess: () => showToast("Removed") })}
                  style={{ flex: 1, paddingVertical: 12, borderRadius: 999, backgroundColor: "#E5484D", alignItems: "center" }}
                >
                  <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13.5, color: colors.white }}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
