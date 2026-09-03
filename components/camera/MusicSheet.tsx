import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Image as ExpoImage } from "expo-image";
import { Music, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Keyboard, TouchableWithoutFeedback, useWindowDimensions, View } from "react-native";
import { ScrollView as SheetScrollView } from "react-native-gesture-handler";

import { IconTile } from "@/components/camera/ComposeChrome";
import { MusicClipScrubber } from "@/components/camera/MusicClipScrubber";
import { Button } from "@/components/ui/Button";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { SearchBar } from "@/components/ui/SearchBar";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { SkeletonTrackRow } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  dedupeTracks,
  recordMusicPick,
  songKey,
  useRecommendedTracks,
  useTopSongs,
  useTrackSearch,
  type MusicTrack
} from "@/lib/music";
import { colors } from "@/theme/colors";
import { icon, radius, space, tokens } from "@/theme/tokens";

export type SelectedTrack = MusicTrack & { clipStart?: number };

export const PREVIEW_SECONDS = 30;

/** Spotify-style explicit marker: gray rounded square with a dark bold E. */
function ExplicitBadge() {
  return (
    <View
      accessibilityLabel="Explicit"
      style={{
        width: 15,
        height: 15,
        borderRadius: 3,
        backgroundColor: colors.silver,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      <Text variant="micro" className="text-black text-[9px] leading-[12px]">
        E
      </Text>
    </View>
  );
}

function TrackArt({ uri }: { uri: string | null }) {
  if (!uri) {
    return (
      <IconTile>
        <Music size={icon.size.xs - 1} color={colors.mist} strokeWidth={icon.stroke.regular} />
      </IconTile>
    );
  }
  return (
    <ExpoImage
      source={{ uri }}
      style={{ width: 38, height: 38, borderRadius: radius.sm - 4, backgroundColor: tokens.bg.raised }}
      contentFit="cover"
    />
  );
}

function TrackSkeleton({ count }: { count: number }) {
  return (
    <View style={{ paddingTop: space[1] + 2 }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonTrackRow key={i} />
      ))}
    </View>
  );
}

/**
 * Add music: search any song, hear it, pick where the clip starts. Selection
 * commits on "Add to post" AND on dismissal (a chosen song that's playing
 * reads as chosen — silently discarding it was the old "select it again" bug).
 */
export function MusicSheet({
  selected,
  onSelect,
  onChange
}: {
  selected: SelectedTrack | null;
  /** Final answer — the caller closes the sheet on this. */
  onSelect: (track: SelectedTrack | null) => void;
  /** Live: the pick as it stands, without closing. */
  onChange: (track: SelectedTrack) => void;
}) {
  const { height: windowHeight } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const results = useTrackSearch(query);
  // Two feeds: songs matched to this user's taste, then today's chart paged
  // for infinite scroll. Dedupe across pages and against RECOMMENDED.
  const recommended = useRecommendedTracks();
  const top = useTopSongs();
  const recommendedTracks = useMemo(() => dedupeTracks(recommended.data ?? []), [recommended.data]);
  const topTracks = useMemo(() => {
    const shown = new Set(recommendedTracks.map(songKey));
    return dedupeTracks((top.data?.pages ?? []).flat()).filter((track) => !shown.has(songKey(track)));
  }, [top.data, recommendedTracks]);
  const rows = results.data ?? [];
  const searching = query.trim().length >= 2;

  /** Pull the next page in when the list nears its end. */
  const onListScroll = (e: {
    nativeEvent: {
      layoutMeasurement: { height: number };
      contentOffset: { y: number };
      contentSize: { height: number };
    };
  }) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const nearEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 320;
    if (nearEnd && top.hasNextPage && !top.isFetchingNextPage) void top.fetchNextPage();
  };
  // Chosen (auditioning) track — plays out loud, with a draggable clip-start.
  const [chosen, setChosen] = useState<SelectedTrack | null>(selected);
  const sheetApi = useSheet();

  /** Commit the picker's result exactly once. */
  const committed = useRef(false);
  const commit = (next: SelectedTrack | null) => {
    if (next) trackAnalyticsEvent("music_selected", { has_preview: Boolean(next.previewUrl) });
    if (committed.current) return;
    committed.current = true;
    // Feeds the taste profile — the only input the recommender learns from.
    if (next) void recordMusicPick(next);
    onSelect(next);
  };
  // Tall picker; shrinks once a song is chosen so the audition card and the
  // Add button never get pushed past the sheet's max height.
  const listHeight = Math.round(windowHeight * (chosen ? 0.3 : 0.46));
  const [clipStart, setClipStart] = useState(selected?.clipStart ?? 0);
  const clipStartRef = useRef(clipStart);
  clipStartRef.current = clipStart;

  const player = useAudioPlayer(chosen?.previewUrl ? { uri: chosen.previewUrl } : null);
  const status = useAudioPlayerStatus(player);
  const playerRef = useRef(player);
  playerRef.current = player;
  const statusRef = useRef(status);
  statusRef.current = status;

  // All native player calls are wrapped: an unready/torn-down player throws
  // synchronously from .play()/.seekTo(), and seeking before load asserts
  // natively. The load effect re-issues the seek once isLoaded flips true.
  const safeSeekPlay = (seconds: number) => {
    const p = playerRef.current;
    if (!p) return;
    const current = statusRef.current;
    if (!current?.isLoaded) return;
    // Never seek past the end of the actual preview.
    const duration = typeof current.duration === "number" && current.duration > 0 ? current.duration : null;
    const target = duration ? Math.min(Math.max(0, seconds), Math.max(0, duration - 0.25)) : Math.max(0, seconds);
    try {
      void Promise.resolve(p.seekTo(target)).catch(() => {});
      p.play();
    } catch {
      // Player not ready yet — the load effect will start it.
    }
  };

  const auditTrack = (track: MusicTrack) => {
    setChosen(track);
    setClipStart(0);
    // Hand it to the post immediately — the choice has visibly been made and
    // must not depend on landing a second tap on "Add to post".
    onChange({ ...track, clipStart: 0 });
    Keyboard.dismiss();
  };

  // Auto-play the audition from the clip start whenever the track loads.
  useEffect(() => {
    if (!chosen?.previewUrl || !status.isLoaded) return;
    safeSeekPlay(clipStartRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.id, status.isLoaded]);

  // Commit on dismissal. Reads through refs so it never re-subscribes on every
  // scrub, and `seenOpen` avoids firing before the sheet has actually opened.
  const latestPick = useRef({ chosen, clipStart });
  latestPick.current = { chosen, clipStart };
  const seenOpen = useRef(false);
  useEffect(() => {
    if (sheetApi.isOpen) {
      seenOpen.current = true;
      return;
    }
    if (!seenOpen.current || committed.current) return;
    const { chosen: pick, clipStart: start } = latestPick.current;
    if (pick) commit({ ...pick, clipStart: start });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetApi.isOpen]);

  const trackRow = (track: MusicTrack, key: string) => (
    <ChoiceRow
      key={key}
      title={track.title}
      sub={track.artist}
      subBadge={track.explicit ? <ExplicitBadge /> : undefined}
      selected={chosen?.id === track.id}
      left={<TrackArt uri={track.artworkUrl} />}
      onPress={() => auditTrack(track)}
    />
  );

  return (
    // Tapping anywhere outside the search field closes the keyboard.
    <TouchableWithoutFeedback onPress={() => Keyboard.dismiss()} accessible={false}>
      <View>
        <SheetTitle>Add music</SheetTitle>
        <SheetSub>Search any song, hear it, and pick where the clip starts.</SheetSub>
        <View style={{ paddingHorizontal: space[4] + 4, paddingBottom: space[2] }}>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search songs or artists" />
        </View>
        <View style={{ height: listHeight }}>
          {!searching ? (
            recommended.isLoading && top.isLoading ? (
              <TrackSkeleton count={6} />
            ) : (
              <SheetScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                onScroll={onListScroll}
                scrollEventThrottle={64}
              >
                {recommendedTracks.length > 0 ? (
                  <>
                    <SectionLabel
                      style={{ paddingHorizontal: space[4] + 4, paddingTop: space[3], paddingBottom: space[1] }}
                    >
                      Recommended for you
                    </SectionLabel>
                    {recommendedTracks.map((track) => trackRow(track, `rec-${track.id}`))}
                  </>
                ) : null}
                <SectionLabel
                  style={{ paddingHorizontal: space[4] + 4, paddingTop: space[3], paddingBottom: space[1] }}
                >
                  Top songs today
                </SectionLabel>
                {topTracks.map((track, i) => trackRow(track, `top-${track.id}-${i}`))}
                {top.isFetchingNextPage ? (
                  <View style={{ paddingVertical: space[3] + 2, alignItems: "center" }}>
                    <ActivityIndicator color={colors.fog} />
                  </View>
                ) : null}
              </SheetScrollView>
            )
          ) : results.isLoading ? (
            <TrackSkeleton count={4} />
          ) : results.isError ? (
            <Text variant="meta" className="pt-7 text-center">
              Search didn&apos;t load. Check your connection and try again.
            </Text>
          ) : rows.length === 0 ? (
            <Text variant="meta" className="pt-7 text-center">
              No songs found for &ldquo;{query.trim()}&rdquo;.
            </Text>
          ) : (
            <SheetScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" nestedScrollEnabled>
              {rows.map((track) => trackRow(track, track.id))}
            </SheetScrollView>
          )}
        </View>

        {/* Audition + clip picker for the chosen song */}
        {chosen ? (
          <View
            style={{
              marginHorizontal: space[4] + 4,
              marginTop: space[1],
              padding: space[3],
              borderRadius: radius.md,
              backgroundColor: tokens.bg.raised
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
              <TrackArt uri={chosen.artworkUrl} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="username" numberOfLines={1}>
                  {chosen.title}
                </Text>
                <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 5 }}>
                  {chosen.explicit ? <ExplicitBadge /> : null}
                  <Text variant="meta" numberOfLines={1} className="flex-shrink text-silver">
                    {chosen.artist}
                  </Text>
                </View>
              </View>
              <Text variant="numeral-sm" className="text-silver">{`0:${String(clipStart).padStart(2, "0")}`}</Text>
            </View>
            {chosen.previewUrl ? (
              <MusicClipScrubber
                previewSeconds={PREVIEW_SECONDS}
                maxStart={PREVIEW_SECONDS - 5}
                initialStart={clipStart}
                onChange={setClipStart}
                onCommit={(sec) => {
                  setClipStart(sec);
                  safeSeekPlay(sec);
                  // Keep the post in step with the scrubber on release, so the
                  // clip start survives a dismissal too.
                  if (chosen) onChange({ ...chosen, clipStart: sec });
                }}
              />
            ) : (
              <Text variant="meta" className="mt-2">
                No preview available for this song — it will still show on your post.
              </Text>
            )}
            <Text variant="meta" className="mt-2 text-[11px]">
              Drag to choose where your clip starts. It plays out loud so you can hear it.
            </Text>
          </View>
        ) : null}

        <View
          style={{ flexDirection: "row", gap: space[2] + 2, paddingHorizontal: space[4] + 4, paddingTop: space[3] + 2 }}
        >
          <Button
            variant="ghost"
            style={{ flex: 1 }}
            icon={<X size={14} color={colors.bone} />}
            onPress={() => commit(null)}
          >
            No music
          </Button>
          <Button
            style={{ flex: 1 }}
            disabled={!chosen}
            onPress={() => {
              if (!chosen) return;
              commit({ ...chosen, clipStart });
            }}
          >
            Add to post
          </Button>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}
