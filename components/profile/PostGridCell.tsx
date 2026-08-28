import { Image } from "expo-image";
import { ImageOff, Play } from "lucide-react-native";
import { View } from "react-native";

import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

/** Corner picture-in-picture for a dual-camera post inside a grid cell. */
function GridInset({ uri }: { uri: string }) {
  return (
    <View
      style={{
        position: "absolute",
        top: 5,
        left: 5,
        width: "31%",
        aspectRatio: 3 / 4,
        borderRadius: 6,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.55)",
        backgroundColor: colors.graphite
      }}
    >
      <Image source={{ uri }} accessible={false} contentFit="cover" style={{ flex: 1 }} cachePolicy="memory-disk" />
    </View>
  );
}

/**
 * One profile-grid cell — shared by the own-profile and other-user grids
 * (posts + tagged). Prefers the small thumbnail for ALL cells (photos and
 * videos); falls back to the full image only for legacy posts with no
 * thumbnail. A raw video file can't render through expo-image, so video
 * cells must always come through the thumbnail.
 */
export function PostGridCell({
  mediaUrl,
  thumbnailUrl,
  insetUrl,
  isVideo
}: {
  mediaUrl: string | null;
  thumbnailUrl?: string | null;
  insetUrl?: string | null;
  isVideo: boolean;
}) {
  // Videos have no renderable media_url fallback — thumbnail or nothing.
  const src = thumbnailUrl ?? (isVideo ? null : mediaUrl);
  return (
    // Placeholder frame while the image streams in (spec #18) — expo-image
    // decodes async + caches to disk, so cells fade in instead of popping.
    <View style={{ flex: 1, backgroundColor: isVideo && !src ? tokens.bg.subtle : colors.graphite }}>
      {src ? (
        <Image source={{ uri: src }} accessible={false} contentFit="cover" transition={140} cachePolicy="memory-disk" style={{ flex: 1 }} />
      ) : (
        // The post is real and still here — only its signed URL is missing this
        // fetch. An empty tile reads as "my post disappeared", so say what it
        // actually is. Pull-to-refresh re-signs it.
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ImageOff size={18} color={tokens.text.tertiary} strokeWidth={1.8} />
        </View>
      )}
      {/* Dual-camera selfie as a corner PIP, mirroring the feed card so a dual
          post is recognisable from the grid (it used to show only the rear shot). */}
      {insetUrl ? <GridInset uri={insetUrl} /> : null}
      {isVideo ? (
        <View
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "rgba(0,0,0,0.55)",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Play size={11} color={colors.white} fill={colors.white} strokeWidth={0} />
        </View>
      ) : null}
    </View>
  );
}
