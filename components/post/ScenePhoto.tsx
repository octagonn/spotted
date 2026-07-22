import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { View, type ViewStyle } from "react-native";

import { FEED_SCENES, type FeedScene } from "@/lib/redesignData";

/** Convert a CSS gradient angle (deg, clockwise from top) to expo-linear-gradient points. */
function gradientPoints(angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  const x = Math.cos(rad) / 2;
  const y = Math.sin(rad) / 2;
  return {
    start: { x: 0.5 - x, y: 0.5 - y },
    end: { x: 0.5 + x, y: 0.5 + y }
  };
}

type ScenePhotoProps = {
  /** Real media URL — takes precedence over `scene`. */
  uri?: string;
  /** Mockup scene gradient placeholder (`.ph s1–s6`). */
  scene?: FeedScene;
  /** Blur radius applied to real images (locked feed). */
  blurRadius?: number;
  /** Legibility gradient overlay (§0): on by default for post media. */
  legibility?: boolean;
  style?: ViewStyle;
};

/**
 * Post media surface — a real photo or a scene-gradient placeholder
 * (mockup `.ph`), with the spec legibility gradient
 * `linear-gradient(180deg, rgba(0,0,0,0.12), transparent 30%, transparent 62%, rgba(0,0,0,0.4))`.
 */
export function ScenePhoto({ uri, scene = "s1", blurRadius, legibility = true, style }: ScenePhotoProps) {
  const def = FEED_SCENES[scene];
  const points = gradientPoints(def.angle);
  return (
    <View style={[{ flex: 1, overflow: "hidden", backgroundColor: "#1C1C1F" }, style]}>
      {uri ? (
        <Image
          source={{ uri }}
          // Recycling hardening: list virtualization reuses this Image across
          // different posts; without a recyclingKey expo-image keeps showing
          // the PREVIOUS post's photo until (unless!) the new source loads —
          // i.e. someone else's picture on your post. Keying by uri clears the
          // surface the moment the source changes.
          recyclingKey={uri}
          blurRadius={blurRadius}
          contentFit="cover"
          transition={150}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : (
        <LinearGradient
          colors={def.colors}
          locations={[0, 0.55, 1]}
          start={points.start}
          end={points.end}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      )}
      {legibility ? (
        <LinearGradient
          colors={["rgba(0,0,0,0.12)", "rgba(0,0,0,0)", "rgba(0,0,0,0)", "rgba(0,0,0,0.4)"]}
          locations={[0, 0.3, 0.62, 1]}
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}
    </View>
  );
}
