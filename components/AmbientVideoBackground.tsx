import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";

// Guarded so builds without the expo-video native module (older TestFlight
// binaries receiving an OTA update) fall back to the aurora background
// instead of crashing.
let ExpoVideo: typeof import("expo-video") | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ExpoVideo = require("expo-video");
} catch {
  ExpoVideo = null;
}

/**
 * Looping ambient gym video for the auth flow. Mounted ONCE in the (auth)
 * layout underneath the navigator, so the video keeps playing continuously
 * while transparent screens (welcome, sign-in) transition over it.
 * absoluteFill + contentFit "cover" fills every screen size with no margins;
 * the scrim keeps white text and buttons readable on top.
 */
export function AmbientVideoBackground() {
  if (!ExpoVideo) return <StillLayer />;
  return <VideoLayer />;
}

/** Video module unavailable (older binaries): a moody gym still + the same scrim. */
function StillLayer() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={require("../assets/images/auth-hero.jpg")}
        contentFit="cover"
        style={StyleSheet.absoluteFill}
        accessible={false}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.75)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

function VideoLayer() {
  const video = ExpoVideo!;
  const VideoView = video.VideoView;
  const player = video.useVideoPlayer(require("@/assets/videos/welcome-bg.mp4"), (p) => {
    p.loop = true;
    p.muted = true;
    p.play();
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        player={player}
        contentFit="cover"
        nativeControls={false}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.55)", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.75)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
