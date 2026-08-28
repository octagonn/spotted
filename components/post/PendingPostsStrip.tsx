import { CloudOff, RotateCw, X } from "lucide-react-native";
import { appAlert } from "@/components/ui/AppDialog";
import { ActivityIndicator, Text as RNText, View } from "react-native";

import { CachedImage } from "@/components/ui/CachedImage";
import { Pressable } from "@/components/ui/Pressable";
import { discardPendingPost, retryPendingPost } from "@/lib/offlineQueue";
import { usePendingPostsStore, type PendingPost } from "@/stores/pendingPosts";
import { colors } from "@/theme/colors";

/**
 * The offline upload queue, surfaced at the top of the feed (Instagram-style):
 * each post captured with no connection shows as a card with its thumbnail and
 * live status until the background uploader gets it through.
 */
export function PendingPostsStrip() {
  const entries = usePendingPostsStore((state) => state.entries);
  if (entries.length === 0) return null;
  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 10, gap: 8 }}>
      {entries.map((entry) => (
        <PendingRow key={entry.id} entry={entry} />
      ))}
    </View>
  );
}

function statusLabel(entry: PendingPost): string {
  if (entry.status === "uploading") return "Posting…";
  if (entry.status === "failed") return "Couldn't upload — tap to retry";
  return "Waiting for connection — uploads automatically";
}

function PendingRow({ entry }: { entry: PendingPost }) {
  const thumb = entry.input.photoUris[0] ?? entry.input.insetUri ?? null;

  const confirmDiscard = () => {
    appAlert("Discard this post?", "It hasn't been uploaded yet and will be gone for good.", [
      { text: "Keep", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => void discardPendingPost(entry.id) }
    ]);
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        backgroundColor: colors.graphite,
        borderWidth: 1,
        borderColor: colors.iron,
        borderRadius: 16,
        paddingVertical: 10,
        paddingLeft: 10,
        paddingRight: 8
      }}
    >
      <View
        style={{
          width: 40,
          height: 52,
          borderRadius: 10,
          overflow: "hidden",
          backgroundColor: colors.charcoal,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {thumb ? (
          <CachedImage source={{ uri: thumb }} style={{ width: 40, height: 52 }} contentFit="cover" />
        ) : (
          <CloudOff size={16} color={colors.fog} strokeWidth={2} />
        )}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <RNText style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.white }}>
          Your SPOTTED
        </RNText>
        <RNText style={{ fontFamily: "Geist_400Regular", fontSize: 12, lineHeight: 16, color: colors.fog }}>
          {statusLabel(entry)}
        </RNText>
      </View>
      {entry.status === "uploading" ? (
        <ActivityIndicator size="small" color={colors.white} style={{ marginRight: 8 }} />
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          {entry.status === "failed" ? (
            <Pressable
              onPress={() => retryPendingPost(entry.id)}
              accessibilityLabel="Retry upload"
              hitSlop={8}
              style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
            >
              <RotateCw size={17} color={colors.white} strokeWidth={2.2} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={confirmDiscard}
            accessibilityLabel="Discard pending post"
            hitSlop={8}
            style={{ width: 36, height: 36, alignItems: "center", justifyContent: "center" }}
          >
            <X size={17} color={colors.fog} strokeWidth={2.2} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
