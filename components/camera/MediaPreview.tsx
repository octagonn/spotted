import { useVideoPlayer, VideoView } from "expo-video";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import type { Mode } from "@/components/camera/types";
import { ScenePhoto } from "@/components/post/ScenePhoto";
import { LiftTag, PlayBadge } from "@/components/ui/Chips";
import { Text } from "@/components/ui/Text";
import { usePhotoAspect } from "@/lib/mediaAspect";
import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

/** Paused, muted first-frame preview of the recorded lift clip. */
export function LiftVideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.pause();
  });
  return <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />;
}

/** The compose-step media thumbnail: photo, swipeable gallery, or lift clip frame. */
export function MediaPreview({
  mode,
  photoUri,
  videoUri,
  photos,
  photoCount = 1,
  lift,
  weight,
  width = "62%"
}: {
  mode: Mode;
  photoUri?: string;
  videoUri?: string;
  /** All photos for a multi-photo daily post — swipeable preview. */
  photos?: string[];
  photoCount?: number;
  lift: string;
  weight: string;
  width?: `${number}%`;
}) {
  const isLift = mode === "lift";
  const [pageW, setPageW] = useState(0);
  const [page, setPage] = useState(0);
  const gallery = !isLift && photos && photos.length > 1 ? photos : null;
  // Photos preview at the photo's OWN ratio — capture is full-frame now, so a
  // fixed feed-band ratio here would cover-crop the compose preview and show
  // ~half the photo that actually posts.
  const photoRatio = usePhotoAspect(photos?.[0] ?? photoUri);
  return (
    <View
      style={{
        width,
        maxWidth: 360,
        // Lift videos keep the 3:4 clip frame.
        aspectRatio: isLift ? 3 / 4 : photoRatio,
        alignSelf: "center",
        borderRadius: radius.md,
        backgroundColor: tokens.bg.raised,
        overflow: "hidden"
      }}
    >
      {isLift && videoUri ? (
        <LiftVideoThumb uri={videoUri} />
      ) : gallery ? (
        <View style={{ flex: 1 }} onLayout={(e) => setPageW(e.nativeEvent.layout.width)}>
          {pageW > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / pageW))}
            >
              {gallery.map((uri) => (
                <View key={uri} style={{ width: pageW, height: "100%" }}>
                  <ScenePhoto uri={uri} scene="s2" />
                </View>
              ))}
            </ScrollView>
          ) : null}
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              bottom: space[2] + 2,
              left: 0,
              right: 0,
              flexDirection: "row",
              justifyContent: "center",
              gap: 5
            }}
          >
            {gallery.map((_, i) => (
              <View
                key={i}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: i === page ? colors.white : colors.hairlineStrong
                }}
              />
            ))}
          </View>
        </View>
      ) : (
        <ScenePhoto uri={isLift ? undefined : photoUri} scene={isLift ? "s6" : "s2"} />
      )}
      {isLift ? (
        <>
          <LiftTag lift={lift} weight={weight} style={{ position: "absolute", left: space[3], top: space[3] }} />
          <PlayBadge style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -28, marginTop: -28 }} />
        </>
      ) : null}
      {!isLift && photoCount > 1 ? (
        <View
          style={{
            position: "absolute",
            top: space[2] + 2,
            right: space[2] + 2,
            paddingVertical: space[1],
            paddingHorizontal: space[2] + 2,
            borderRadius: radius.pill,
            backgroundColor: tokens.bg.scrim
          }}
        >
          <Text variant="mono" className="text-white">
            {photoCount} PHOTOS
          </Text>
        </View>
      ) : null}
    </View>
  );
}
