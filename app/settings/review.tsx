import { Image } from "expo-image";
import { ShieldCheck } from "lucide-react-native";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { SkeletonMediaCard } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { useIsAdmin, useReviewQueue, useReviewResolve } from "@/hooks/queries/useModeration";
import { DEFAULT_POST_RATIO } from "@/lib/postFrame";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

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
  const shield = <ShieldCheck size={icon.size.sm + 2} color={colors.silver} strokeWidth={icon.stroke.regular} />;

  if (isAdmin.data === false) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        <PanelHeader title="Review queue" />
        <EmptyState center icon={shield} title="Admins only" body="This queue is only visible to app admins." />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <PanelHeader title="Review queue" sub={queue.data ? `${queue.data.length} flagged` : undefined} />
      {queue.isLoading ? (
        <View style={{ paddingTop: space[4] }}>
          <SkeletonMediaCard />
          <SkeletonMediaCard />
        </View>
      ) : (queue.data ?? []).length === 0 ? (
        <EmptyState center icon={shield} title="Queue clear" body="Nothing awaiting review." />
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: insets.bottom + space[6] }}
        >
          {(queue.data ?? []).map((item) => (
            <View
              key={item.postId}
              style={{ borderRadius: radius.md, overflow: "hidden", backgroundColor: tokens.bg.raised }}
            >
              <View style={{ aspectRatio: DEFAULT_POST_RATIO, backgroundColor: colors.graphite }}>
                {item.mediaUrl ? (
                  <Image
                    accessibilityLabel="Flagged photo"
                    source={{ uri: item.mediaUrl }}
                    contentFit="cover"
                    style={{ flex: 1 }}
                  />
                ) : null}
                {item.insetUrl ? (
                  <View
                    style={{
                      position: "absolute",
                      top: space[3],
                      left: space[3],
                      width: "30%",
                      aspectRatio: 3 / 4,
                      borderRadius: radius.sm,
                      overflow: "hidden",
                      borderWidth: 2,
                      borderColor: colors.black
                    }}
                  >
                    <Image source={{ uri: item.insetUrl }} contentFit="cover" style={{ flex: 1 }} />
                  </View>
                ) : null}
                <View
                  style={{
                    position: "absolute",
                    bottom: space[2] + 2,
                    right: space[2] + 2,
                    paddingVertical: space[1],
                    paddingHorizontal: space[2] + 2,
                    borderRadius: radius.pill,
                    backgroundColor: tokens.bg.scrim
                  }}
                >
                  <Text variant="mono" className="text-white">
                    {`nsfw ${item.score != null ? `${Math.round(item.score * 100)}%` : "?"}`}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: space[2] + 2, padding: space[3] }}>
                <Button
                  variant="ghost"
                  style={{ flex: 1 }}
                  accessibilityLabel={`Approve flagged post by user ${item.userId}`}
                  onPress={() =>
                    resolve.mutate({ postId: item.postId, approve: true }, { onSuccess: () => showToast("Approved") })
                  }
                >
                  Approve
                </Button>
                <Button
                  variant="danger-solid"
                  style={{ flex: 1 }}
                  accessibilityLabel={`Remove flagged post by user ${item.userId}`}
                  onPress={() =>
                    resolve.mutate({ postId: item.postId, approve: false }, { onSuccess: () => showToast("Removed") })
                  }
                >
                  Remove
                </Button>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
