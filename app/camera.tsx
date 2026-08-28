import { useQueryClient } from "@tanstack/react-query";
import { appAlert } from "@/components/ui/AppDialog";
// Gesture-handler ScrollView: scrolls correctly inside the bottom sheet, where
// BottomSheetScrollView only works as the sheet's direct child and RN's own
// ScrollView loses the pan gesture to the sheet.
import { Gesture, GestureDetector, ScrollView as SheetScrollView } from "react-native-gesture-handler";
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from "expo-camera";

import { INSET_RATIO, POST_PHOTO_RATIO, captureCropRect } from "@/lib/captureCrop";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import {
  ChevronLeft,
  Download,
  Dumbbell,
  Home,
  Image as ImageIcon,
  Lock,
  MapPin,
  Music,
  Pencil,
  Plus,
  RefreshCw,
  Tag,
  Timer as TimerIcon,
  Users,
  X,
  Zap,
  ZapOff
} from "lucide-react-native";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as ImageManipulator from "expo-image-manipulator";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  ActivityIndicator,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { LiftVideoReview, type VideoTrim } from "@/components/camera/LiftVideoReview";
import { MusicClipScrubber } from "@/components/camera/MusicClipScrubber";
import { ShutterButton } from "@/components/camera/ShutterButton";
import { type TrophyShareData } from "@/components/trophies/TrophyShareCard";
import {
  deleteCameraDrafts,
  loadCameraDrafts,
  saveCameraDraft,
  takeDraftResume,
  type CameraDraft,
  type CameraDraftInput
} from "@/lib/cameraDraft";
import { impactHaptic } from "@/lib/haptics";
import { LIFT_OPTIONS, LIFT_OPTION_BY_ID, newlyUnlockedTiers, type LiftExercise } from "@/lib/liftCatalog";
import { useLogLift, useUserLifts } from "@/hooks/queries/useUserLifts";
import { PhotoEditor } from "@/components/camera/PhotoEditor";
import { PhotoTagOverlay, type PhotoTag } from "@/components/camera/PhotoTagOverlay";
import { EditorBoundary } from "@/components/EditorBoundary";
import { ScenePhoto } from "@/components/post/ScenePhoto";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { LiftTag, PlayBadge } from "@/components/ui/Chips";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { OptRow } from "@/components/ui/OptRow";
import { PanelHeader } from "@/components/ui/PanelHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { Hairline, SectionLabel } from "@/components/ui/SectionLabel";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { SkeletonRow, SkeletonRows, SkeletonTrackRow } from "@/components/ui/Skeleton";
import {
  formatDistance,
  useGymSearch,
  type GymSearchCoords,
  type GymSearchResult
} from "@/hooks/queries/useGymSearch";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { captureRef } from "react-native-view-shot";

import { useFriends } from "@/hooks/queries/useFriends";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import {
  dedupeTracks,
  recordMusicPick,
  songKey,
  useRecommendedTracks,
  useTopSongs,
  useTrackSearch,
  type MusicTrack
} from "@/lib/music";
import { useMyCommunities, type CommunitySummary } from "@/hooks/queries/useCommunities";
import { usePostedState } from "@/hooks/queries/usePostedState";
import { usePostStory } from "@/hooks/queries/useStories";
import { StoryDestinationSheet, type StoryDestination } from "@/components/story/StoryDestinationSheet";
import { CameraKitCircleButton as CircleButton, cameraSurfaceProps } from "@/components/camera/CameraKit";
import { FrontFlash } from "@/components/camera/FrontFlash";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { savePhotoToCameraRoll } from "@/lib/mediaLibrary";
import { invalidateAfterPostChange } from "@/lib/queryClient";
import { attachDailyPostExtras, publishDailyPost, publishLiftVideo } from "@/lib/posts";
import { enqueueDailyPost, isNetworkError } from "@/lib/offlineQueue";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { markPostedToday, showToast, triggerFlash, triggerPostCelebration } from "@/stores/ui";
import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

type Mode = "daily" | "lift" | "story";
type DailyStep = "capture" | "review" | "compose";
type LiftStep = "record" | "review" | "liftmeta" | "compose";
type DualPhase = "off" | "selfie" | "main";

/** Where the post happened: a real mapped gym row, or an unmapped location. */
type SelectedGym =
  | { type: "gym"; id: string; name: string }
  | { type: "home" }
  | { type: "other" };


// Module-scoped so it survives camera remounts: we only auto-prompt for
// location once per app session, never on every open.
let locationAskedThisSession = false;


/** Mirror (front camera) and center-crop a capture to `ratio` (w/h) in one
 *  re-encode. Returns the untouched uri when no transform is needed. */
async function finalizeCapture(
  photo: { uri: string; width?: number; height?: number },
  {
    mirror,
    ratio,
    compress = 0.95,
    previewRatio = null
  }: { mirror: boolean; ratio: number | null; compress?: number; previewRatio?: number | null }
): Promise<string> {
  const actions: ImageManipulator.Action[] = [];
  if (mirror) actions.push({ flip: ImageManipulator.FlipType.Horizontal });
  if (photo.width && photo.height) {
    const rect = captureCropRect(photo.width, photo.height, previewRatio, ratio);
    if (rect) actions.push({ crop: rect });
  }
  if (actions.length === 0) return photo.uri;
  const out = await ImageManipulator.manipulateAsync(photo.uri, actions, {
    compress,
    format: ImageManipulator.SaveFormat.JPEG
  });
  return out.uri;
}


function gymName(gym: SelectedGym | null): string | null {
  if (!gym) return null;
  if (gym.type === "home") return "Custom location";
  if (gym.type === "other") return "Other location";
  return gym.name;
}


/** Dual-camera glyph, Snapchat-style: two overlapping rounded frames offset
 *  diagonally (front card occludes the back one). */
function DualCameraIcon({ active }: { active: boolean }) {
  const color = active ? tokens.accent.gold : colors.white;
  return (
    <View style={{ width: 20, height: 20 }}>
      {/* back frame — top-right */}
      <View
        style={{ position: "absolute", top: 0, right: 0, width: 13, height: 13, borderRadius: 4, borderWidth: 1.8, borderColor: color, opacity: 0.6 }}
      />
      {/* front frame — bottom-left, filled with the button bg so it occludes */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          width: 13,
          height: 13,
          borderRadius: 4,
          borderWidth: 1.8,
          borderColor: color,
          backgroundColor: "rgba(0,0,0,0.55)"
        }}
      />
    </View>
  );
}

function StepPill({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 7,
        backgroundColor: "rgba(0,0,0,0.62)",
        borderWidth: 1,
        borderColor: colors.white,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 16
      }}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.white }} />
      <Text
        style={{
          fontFamily: "Geist_700Bold",
          fontSize: 12,
          letterSpacing: 12 * 0.1,
          textTransform: "uppercase",
          color: colors.white
        }}
      >
        {children}
      </Text>
    </View>
  );
}


function IconTile({ children, round = false }: { children: ReactNode; round?: boolean }) {
  return (
    <View
      style={{
        width: 38,
        height: 38,
        borderRadius: round ? 19 : 10,
        borderWidth: 1,
        borderColor: colors.slate,
        alignItems: "center",
        justifyContent: "center"
      }}
    >
      {children}
    </View>
  );
}

/** Paused, muted first-frame preview of the recorded lift clip. */
function LiftVideoThumb({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.pause();
  });
  return (
    <VideoView
      player={player}
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

function MediaPreview({
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
  return (
    <View
      style={{
        width,
        maxWidth: 360,
        // Photos preview at the feed frame ratio (matches the capture crop);
        // lift videos keep the 3:4 clip frame.
        aspectRatio: isLift ? 3 / 4 : POST_PHOTO_RATIO,
        alignSelf: "center",
        borderRadius: 18,
        borderWidth: 1,
        borderColor: colors.iron,
        backgroundColor: colors.graphite,
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
          <View pointerEvents="none" style={{ position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 }}>
            {gallery.map((_, i) => (
              <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i === page ? colors.white : "rgba(255,255,255,0.4)" }} />
            ))}
          </View>
        </View>
      ) : (
        <ScenePhoto uri={isLift ? undefined : photoUri} scene={isLift ? "s6" : "s2"} />
      )}
      {isLift ? (
        <>
          <LiftTag lift={lift} weight={weight} style={{ position: "absolute", left: 12, top: 12 }} />
          <PlayBadge style={{ position: "absolute", left: "50%", top: "50%", marginLeft: -28, marginTop: -28 }} />
        </>
      ) : null}
      {!isLift && photoCount > 1 ? (
        <View style={{ position: "absolute", top: 10, right: 10, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.6)" }}>
          <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 10.5, color: colors.white }}>
            {photoCount} PHOTOS
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Hard geofence for posting a gym photo: 0.2 miles. */
const GYM_GEOFENCE_METERS = 0.2 * 1609.344;

function GymSheet({
  selected,
  coords,
  locationSettled,
  onSelect
}: {
  selected: SelectedGym | null;
  coords: GymSearchCoords | null;
  locationSettled: boolean;
  onSelect: (gym: SelectedGym) => void;
}) {
  const [query, setQuery] = useState("");
  const { height: windowHeight } = useWindowDimensions();
  const listHeight = Math.min(300, Math.round(windowHeight * 0.32));
  const gyms = useGymSearch(query, coords, locationSettled);
  const rows: GymSearchResult[] = (gyms.data?.pages?.[0] ?? []).slice(0, 20);

  return (
    <View>
      <SheetTitle>Where was this?</SheetTitle>
      <SheetSub>
        Mapped gyms show on the post. Custom locations and unlisted spots won&apos;t claim a mapped gym.
      </SheetSub>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search gyms" />
      </View>
      {/* Fixed-height results area: the sheet is dynamically sized, so without
          this it shrinks as search narrows the list and slides under the
          keyboard. Results scroll inside instead. Height is capped to the
          screen so the rows below never clip past the sheet's 78% max. */}
      <View style={{ height: listHeight }}>
        {gyms.isLoading || !locationSettled ? (
          <View style={{ paddingTop: 6 }}>
            <SkeletonRow avatar={0} />
            <SkeletonRow avatar={0} />
            <SkeletonRow avatar={0} />
            <SkeletonRow avatar={0} />
          </View>
        ) : rows.length === 0 ? (
          <Text style={{ paddingTop: 28, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            No gyms found. Try a different name.
          </Text>
        ) : (
          <SheetScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {rows.map((gym) => {
              const distance = formatDistance(gym.distance_meters);
              return (
                <ChoiceRow
                  key={gym.id}
                  title={gym.name}
                  sub={[gym.address, distance].filter(Boolean).join(" \u00b7 ") || "Mapped gym"}
                  selected={selected?.type === "gym" && selected.id === gym.id}
                  left={<IconTile round><Dumbbell size={15} color={colors.mist} /></IconTile>}
                  onPress={() => onSelect({ type: "gym", id: gym.id, name: gym.name })}
                />
              );
            })}
          </SheetScrollView>
        )}
      </View>
      <Hairline style={{ marginVertical: 6, marginHorizontal: 20 }} />
      <ChoiceRow
        title="Custom location"
        sub="Home gym or another spot that isn't mapped"
        selected={selected?.type === "home"}
        left={<IconTile round><Home size={15} color={colors.mist} /></IconTile>}
        onPress={() => onSelect({ type: "home" })}
      />
      <ChoiceRow
        title="Other / unlisted"
        sub="Not a mapped gym"
        selected={selected?.type === "other"}
        left={<IconTile round><MapPin size={15} color={colors.mist} /></IconTile>}
        onPress={() => onSelect({ type: "other" })}
      />
    </View>
  );
}

function FriendsSheet({ initial, onDone }: { initial: string[]; onDone: (ids: string[]) => void }) {
  const sheet = useSheet();
  const friends = useFriends();
  const { height: windowHeight } = useWindowDimensions();
  const listHeight = Math.min(300, Math.round(windowHeight * 0.32));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(initial);
  const toggle = (id: string) => setSelected((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);

  const q = query.trim().toLowerCase();
  const rows = (friends.data ?? []).filter(
    (friend) => !q || `${friend.display_name} ${friend.username}`.toLowerCase().includes(q)
  );

  return (
    <View>
      <SheetTitle>Tag friends</SheetTitle>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search friends" />
      </View>
      {/* Fixed height so the sheet doesn't shrink under the keyboard while
          searching, capped to the screen so the Done button never clips. */}
      <View style={{ height: listHeight }}>
        {friends.isLoading ? (
          <SkeletonRows count={4} style={{ paddingTop: 6 }} />
        ) : rows.length === 0 ? (
          <Text style={{ paddingTop: 28, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            {q ? "No friends match that name." : "No friends yet — add your crew from the Friends tab."}
          </Text>
        ) : (
          <SheetScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {rows.map((friend) => (
              <ChoiceRow
                key={friend.id}
                title={friend.display_name}
                sub={`@${friend.username}`}
                selected={selected.includes(friend.id)}
                left={<Avatar name={friend.display_name} uri={friend.avatar_url} size={40} />}
                onPress={() => toggle(friend.id)}
              />
            ))}
          </SheetScrollView>
        )}
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Button onPress={() => { onDone(selected); sheet.close(); }}>Done</Button>
      </View>
    </View>
  );
}

type SelectedTrack = MusicTrack & { clipStart?: number };

const PREVIEW_SECONDS = 30;

/** Spotify-style explicit marker: gray rounded square with a dark bold E. */
function ExplicitBadge() {
  return (
    <View
      accessibilityLabel="Explicit"
      style={{ width: 15, height: 15, borderRadius: 3, backgroundColor: colors.silver, alignItems: "center", justifyContent: "center" }}
    >
      <Text style={{ fontFamily: "Geist_700Bold", fontSize: 9.5, lineHeight: 12, color: colors.black }}>E</Text>
    </View>
  );
}

/** Uppercase divider between picker sections. */
function SectionHeader({ label }: { label: string }) {
  return (
    <Text
      style={{
        paddingHorizontal: 20,
        paddingTop: 12,
        paddingBottom: 4,
        fontFamily: "GeistMono_400Regular",
        fontSize: 10.5,
        letterSpacing: 10.5 * 0.14,
        color: colors.fog
      }}
    >
      {label}
    </Text>
  );
}

function MusicSheet({
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
  // for infinite scroll.
  const recommended = useRecommendedTracks();
  const top = useTopSongs();
  // Chart pages arrive independently, so the same song can land on more than
  // one page — and anything already shown under RECOMMENDED would otherwise
  // appear a second time a few rows further down.
  const recommendedTracks = useMemo(() => dedupeTracks(recommended.data ?? []), [recommended.data]);
  const topTracks = useMemo(() => {
    const shown = new Set(recommendedTracks.map(songKey));
    return dedupeTracks((top.data?.pages ?? []).flat()).filter((track) => !shown.has(songKey(track)));
  }, [top.data, recommendedTracks]);
  const rows = results.data ?? [];
  const searching = query.trim().length >= 2;

  /** Pull the next page in when the list nears its end. */
  const onListScroll = (e: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const nearEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 320;
    if (nearEnd && top.hasNextPage && !top.isFetchingNextPage) void top.fetchNextPage();
  };
  // Chosen (auditioning) track — plays out loud, with a draggable clip-start.
  const [chosen, setChosen] = useState<SelectedTrack | null>(selected);
  const sheetApi = useSheet();

  /**
   * Commit the picker's result exactly once.
   *
   * Tapping a song marks the row selected AND starts playing it, which reads as
   * "chosen" — so dismissing the sheet there (swipe down, or tap the backdrop,
   * which closes on press) felt like confirming. It silently discarded the
   * pick instead, the post came back with no music, and the whole selection had
   * to be done a second time. Now a dismissal commits whatever is chosen.
   */
  const committed = useRef(false);
  const commit = (next: SelectedTrack | null) => {
    if (next) trackAnalyticsEvent("music_selected", { has_preview: Boolean(next.previewUrl) });
    if (committed.current) return;
    committed.current = true;
    // Feeds the taste profile — the only input the recommender learns from.
    if (next) void recordMusicPick(next);
    onSelect(next);
  };
  // Tall picker: the old 28% list showed ~4 songs at a time. The sheet host
  // grows to 78% of the screen, so give the list most of that — but shrink it
  // once a song is chosen, otherwise the audition card and the Add to post
  // button get pushed past the sheet's max height and clipped off-screen.
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
  // synchronously from .play()/.seekTo(), which crashed the picker (the
  // reported "selecting the segment crashes" bug).
  const safeSeekPlay = (seconds: number) => {
    const p = playerRef.current;
    if (!p) return;
    // Seeking a player that has not finished loading is the other way this
    // crashed: the native side asserts rather than throwing something JS can
    // catch. The load effect re-issues the seek once isLoaded flips true, so
    // bailing here loses nothing.
    const current = statusRef.current;
    if (!current?.isLoaded) return;
    // Never seek past the end of the actual preview — the 30s length is an
    // assumption, and a short preview would otherwise get an out-of-range seek.
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
    // Hand it to the post immediately. The row already renders as selected and
    // starts playing, so the choice has visibly been made — it must not depend
    // on landing a second tap on "Add to post". With the search keyboard up,
    // that second tap is genuinely easy to miss: the sheet floats above the
    // keyboard (keyboardBehavior="interactive"), so the tap that dismisses the
    // keyboard also re-lays-out the sheet and slides the button out from under
    // your finger. That was "it makes me select a song again".
    onChange({ ...track, clipStart: 0 });
    // Settle the layout now rather than on the way to the button.
    Keyboard.dismiss();
  };

  // Auto-play the audition from the clip start whenever the track loads.
  useEffect(() => {
    if (!chosen?.previewUrl || !status.isLoaded) return;
    safeSeekPlay(clipStartRef.current);
    // Replay only on track change / initial load, not every status tick.
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

  const dismissKeyboard = () => Keyboard.dismiss();

  return (
    // Tapping anywhere outside the search field closes the keyboard.
    <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
    <View>
      <SheetTitle>Add music</SheetTitle>
      <SheetSub>Search any song, hear it, and pick where the clip starts.</SheetSub>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search songs or artists" />
      </View>
      <View style={{ height: listHeight }}>
        {!searching ? (
          recommended.isLoading && top.isLoading ? (
            <View style={{ paddingTop: 6 }}>
              <SkeletonTrackRow />
              <SkeletonTrackRow />
              <SkeletonTrackRow />
              <SkeletonTrackRow />
              <SkeletonTrackRow />
              <SkeletonTrackRow />
            </View>
          ) : (
            <SheetScrollView
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              onScroll={onListScroll}
              scrollEventThrottle={64}
            >
              {/* Matched to what this user actually picks — sharpens over time. */}
              {recommendedTracks.length > 0 ? (
                <>
                  <SectionHeader label="RECOMMENDED FOR YOU" />
                  {recommendedTracks.map((track) => (
                    <ChoiceRow
                      key={`rec-${track.id}`}
                      title={track.title}
                      sub={track.artist}
                      subBadge={track.explicit ? <ExplicitBadge /> : undefined}
                      selected={chosen?.id === track.id}
                      left={<TrackArt uri={track.artworkUrl} />}
                      onPress={() => auditTrack(track)}
                    />
                  ))}
                </>
              ) : null}

              <SectionHeader label="TOP SONGS TODAY" />
              {topTracks.map((track: MusicTrack, i: number) => (
                <ChoiceRow
                  key={`top-${track.id}-${i}`}
                  title={track.title}
                  sub={track.artist}
                  subBadge={track.explicit ? <ExplicitBadge /> : undefined}
                  selected={chosen?.id === track.id}
                  left={<TrackArt uri={track.artworkUrl} />}
                  onPress={() => auditTrack(track)}
                />
              ))}
              {top.isFetchingNextPage ? (
                <View style={{ paddingVertical: 14, alignItems: "center" }}>
                  <ActivityIndicator color={colors.fog} />
                </View>
              ) : null}
            </SheetScrollView>
          )
        ) : results.isLoading ? (
          <View style={{ paddingTop: 6 }}>
            <SkeletonTrackRow />
            <SkeletonTrackRow />
            <SkeletonTrackRow />
            <SkeletonTrackRow />
          </View>
        ) : results.isError ? (
          <Text style={{ paddingTop: 28, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            Search didn't load. Check your connection and try again.
          </Text>
        ) : rows.length === 0 ? (
          <Text style={{ paddingTop: 28, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
            No songs found for &ldquo;{query.trim()}&rdquo;.
          </Text>
        ) : (
          <SheetScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" nestedScrollEnabled>
            {rows.map((track) => (
              <ChoiceRow
                key={track.id}
                title={track.title}
                sub={track.artist}
                subBadge={track.explicit ? <ExplicitBadge /> : undefined}
                selected={chosen?.id === track.id}
                left={<TrackArt uri={track.artworkUrl} />}
                onPress={() => auditTrack(track)}
              />
            ))}
          </SheetScrollView>
        )}
      </View>

      {/* Audition + clip picker for the chosen song */}
      {chosen ? (
        <View style={{ marginHorizontal: 20, marginTop: 4, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.iron, backgroundColor: colors.charcoal }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <TrackArt uri={chosen.artworkUrl} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontFamily: "Geist_700Bold", fontSize: 16, color: colors.white }}>
                {chosen.title}
              </Text>
              <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 5 }}>
                {chosen.explicit ? <ExplicitBadge /> : null}
                <Text numberOfLines={1} style={{ flexShrink: 1, fontSize: 12.5, color: colors.silver }}>
                  {chosen.artist}
                </Text>
              </View>
            </View>
            <Text style={{ fontFamily: "GeistMono_500Medium", fontSize: 12, color: colors.silver }}>
              {`0:${String(clipStart).padStart(2, "0")}`}
            </Text>
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
            <Text style={{ marginTop: 10, fontSize: 11.5, color: colors.fog }}>
              No preview available for this song — it will still show on your post.
            </Text>
          )}
          <Text style={{ marginTop: 8, fontSize: 10.5, color: colors.fog }}>
            Drag to choose where your clip starts. It plays out loud so you can hear it.
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20, paddingTop: 14 }}>
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

function TrackArt({ uri }: { uri: string | null }) {
  if (!uri) {
    return <IconTile><Music size={15} color={colors.mist} /></IconTile>;
  }
  return (
    <ExpoImage
      source={{ uri }}
      style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: colors.charcoal }}
      contentFit="cover"
    />
  );
}

function CommunitySheet({
  chosenGymId,
  initial,
  onDone
}: {
  chosenGymId: string | null;
  initial: string[];
  onDone: (ids: string[]) => void;
}) {
  const sheet = useSheet();
  const communities = useMyCommunities();
  const [selected, setSelected] = useState(initial);

  const eligible = (community: CommunitySummary) =>
    community.type !== "gym" || community.gym_id === chosenGymId;

  const toggle = (community: CommunitySummary) => {
    if (!eligible(community)) return;
    setSelected((ids) => ids.includes(community.id) ? ids.filter((id) => id !== community.id) : [...ids, community.id]);
  };

  return (
    <View>
      <SheetTitle>Post to a community</SheetTitle>
      <SheetSub>Gym communities need this post tagged at that gym. Your other communities are always open.</SheetSub>
      {(communities.data ?? []).length === 0 && !communities.isLoading ? (
        <Text style={{ paddingHorizontal: 20, paddingVertical: 14, fontSize: 12.5, color: colors.fog }}>
          You're not in any communities yet. Join one from the Map tab first.
        </Text>
      ) : null}
      {(communities.data ?? []).map((community) => {
        const disabled = !eligible(community);
        const sub = disabled
          ? "Tag this gym on the post to share here"
          : `${community.type[0].toUpperCase()}${community.type.slice(1)} \u00b7 ${community.memberCount} member${community.memberCount === 1 ? "" : "s"}`;
        return (
          <ChoiceRow
            key={community.id}
            title={community.name}
            sub={sub}
            selected={selected.includes(community.id)}
            disabled={disabled}
            left={<IconTile><Users size={16} color={colors.mist} /></IconTile>}
            onPress={() => toggle(community)}
          />
        );
      })}
      <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
        <Button onPress={() => { onDone(selected); sheet.close(); }}>Done</Button>
      </View>
    </View>
  );
}

export default function CameraScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; community?: string; workout?: string }>();
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const sheet = useSheet();
  const queryClient = useQueryClient();
  const keyboardVisible = useKeyboardVisible();
  const userId = useAuthStore((state) => state.userId);
  const postStory = usePostStory();
  const [permission, requestPermission] = useCameraPermissions();
  // Freeze fix: the native camera session dies quietly when the screen loses
  // focus (saving a draft and leaving, resuming later, backgrounding). Unmount
  // the CameraView while unfocused and remount it with a fresh key on every
  // refocus so it always comes back with a live session.
  const isFocused = useIsFocused();
  const [camEpoch, setCamEpoch] = useState(0);
  useEffect(() => {
    if (isFocused) setCamEpoch((e) => e + 1);
  }, [isFocused]);
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const permissionAsked = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  const reviewCaptureRef = useRef<View>(null);
  // Share-screen scroller — the caption scrolls above the keyboard on focus.
  const shareScrollRef = useRef<ScrollView>(null);
  // Set by onCameraReady; gates recordAsync so we never record mid-reconfigure.
  const videoReadyRef = useRef(false);
  const lastTapRef = useRef(0);

  // Capture starts on Story or Daily; video is now always a hold-to-record
  // action on the shutter, so there's no separate Video mode to start in.
  // The camera page posts STORIES by default. The daily post is a distinct
  // flow reached only via ?mode=daily (the "Post today's SPOTTED" button in the
  // home-feed lock overlay) — there's no in-camera Daily/Story selector.
  const [mode, setMode] = useState<Mode>(() => (params.mode === "daily" ? "daily" : "story"));
  const [dailyStep, setDailyStep] = useState<DailyStep>("capture");
  // Stories are locked until today's SPOTTED is posted (feed-lock philosophy):
  // offer to switch into the daily flow instead of letting a story compose.
  const { postedToday, resolved: postedResolved } = usePostedState();
  const storyGateShown = useRef(false);
  useEffect(() => {
    if (mode === "story" && postedResolved && !postedToday && !storyGateShown.current) {
      storyGateShown.current = true;
      appAlert("Post your SPOTTED first", "Stories unlock after you post today's SPOTTED.", [
        { text: "Not now", style: "cancel", onPress: () => router.back() },
        { text: "Post my SPOTTED", onPress: () => setMode("daily") }
      ]);
    }
  }, [mode, postedResolved, postedToday, router]);
  const [liftStep, setLiftStep] = useState<LiftStep>("record");
  const [videoUri, setVideoUri] = useState<string>();
  const videoTrimRef = useRef<VideoTrim | null>(null);
  // Expo Camera supports one active native preview at a time. Dual mode frames
  // each lens deliberately: live selfie inset first, then the rear shot with
  // that selfie pinned in the corner.
  const [dualFrontUri, setDualFrontUri] = useState<string>();
  const [dualBusy, setDualBusy] = useState(false);
  const [dualPhase, setDualPhase] = useState<DualPhase>("off");
  const [savingToLibrary, setSavingToLibrary] = useState(false);
  const [editing, setEditing] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  // Camera zoom prop (0–1 within the active lens). Ultra-wide holds 0 (pure
  // 0.5×); the recording ref pins the lens for the whole take (switching
  // lenses mid-record would reconfigure the session).
  const recordUltraRef = useRef(false);
  const zoomBaseRef = useRef(0);
  // Debounce the flip: rapid taps otherwise reconfigure the session faster than
  // it can keep up and stall the camera.
  const flipLockRef = useRef(false);
  const [recording, setRecording] = useState(false);
  /** True between finger-up and the encoder handing back the file (#2). */
  const [finalizing, setFinalizing] = useState(false);
  /** Hands-free lock (slid onto the lock icon) — recording continues after release. */
  const [recordLocked, setRecordLocked] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [flashOn, setFlashOn] = useState(false);
  // Ultra-wide (0.5×): pinching out past 1× hands off to the ultra-wide lens
  // when the device has one. Virtual zoom < 0 = ultra-wide territory.
  const [availableLenses, setAvailableLenses] = useState<string[]>([]);
  const ultraLens = facing === "back" ? availableLenses.find((l) => /ultra.?wide/i.test(l)) ?? null : null;
  const [virtualZoom, setVirtualZoom] = useState(0);
  const ultraActive = Boolean(ultraLens) && (recording ? recordUltraRef.current : virtualZoom < 0);
  /** Full ultra-wide travel: virtualZoom −0.35 = full 0.5×. */
  const ULTRA_RANGE = 0.35;
  /** Ultra-wide zoom value that roughly matches the main lens at 1× (the
   *  ultra-wide digitally zoomed ~2× ≈ the wide's native FOV). Continuity
   *  anchor for the smooth iPhone-style handoff — tune on device if the
   *  crossover shows a visible jump. */
  const ULTRA_ENTRY_ZOOM = 0.12;
  // Smooth zoom-out (not a hard switch): crossing 1× keeps the SAME field of
  // view (ultra-wide zoomed in to match 1×), then widens continuously toward
  // 0.5× as the pinch continues.
  const ultraProgress = ultraActive ? Math.min(1, -virtualZoom / ULTRA_RANGE) : 0;
  const cameraZoom = ultraActive
    ? ULTRA_ENTRY_ZOOM * (1 - ultraProgress)
    : Math.max(0, Math.min(1, virtualZoom));
  /** The user-facing zoom multiplier (1× ↔ 0.5× across the ultra travel). */
  const zoomLabel = ultraActive ? 1 - 0.5 * ultraProgress : 1 + cameraZoom * 4;
  /** Keep virtual zoom in range; while recording, never cross the lens boundary. */
  const clampVirtual = (next: number): number => {
    if (recording) {
      return recordUltraRef.current ? Math.max(-ULTRA_RANGE, Math.min(-0.01, next)) : Math.max(0, Math.min(1, next));
    }
    return Math.max(ultraLens ? -ULTRA_RANGE : 0, Math.min(1, next));
  };
  /**
   * Discrete iPhone-style lens jump: crossing below 1× lands squarely on TRUE
   * 0.5× (ultra-wide at zoom 0) instead of stranding mid-interpolation — one
   * pinch could never complete the old smooth travel, so "0.5×" was really
   * ~0.7×. Zooming back past the midpoint snaps home to 1×.
   */
  const stepZoom = (prev: number, next: number): number => {
    if (ultraLens && !recording) {
      if (prev >= 0 && next < -0.02) return -ULTRA_RANGE; // 1× → full 0.5×
      if (prev < 0) return next > -ULTRA_RANGE / 2 ? 0 : -ULTRA_RANGE; // 0.5× → 1× or stay parked
    }
    return clampVirtual(next);
  };
  // Camera session config. This is THE lever on post image quality: in "video"
  // mode the session preset is 1080p, so takePictureAsync hands back a video
  // FRAME (1080x1920, video-grade ISP — no Smart HDR / Deep Fusion, poor in the
  // mixed, dim light of a gym). In "picture" mode the same tap captures the
  // full sensor (~12 MP) through the photo pipeline. Both end up downscaled to
  // the same upload width, but one is a downsampled 12 MP photo and the other
  // is an upscaled-looking video still — that gap is why posts looked soft.
  //
  // Everything was pinned to "video" because a picture-mode session made
  // hold-to-record hang recordAsync forever. So instead of pinning, the mode
  // follows INTENT: daily sits in picture mode for the tap, and holding the
  // shutter flips it to video first. startRecording already waits on
  // videoReadyRef (the same handshake the dual-camera lens flip uses), so the
  // reconfigure is covered rather than raced.
  const [recordIntent, setRecordIntent] = useState(false);
  const camMode: "picture" | "video" = mode === "daily" && !recordIntent ? "picture" : "video";
  const [photoUri, setPhotoUri] = useState<string>();
  /** Earlier shots in a multi-photo daily post (carousel). Max 4 total. */
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  // Workout entry — the exercise list is the strength trophy catalog, and the
  // number (weight for barbell lifts, reps for bodyweight) drives the trophy.
  const [liftExercise, setLiftExercise] = useState<LiftExercise>("bench");
  const [liftValue, setLiftValue] = useState("");
  const userLifts = useUserLifts(userId);
  const logLift = useLogLift();
  const [gym, setGym] = useState<SelectedGym | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  // Positional photo tags (M1) — placed on the daily photo; their user ids also
  // feed `tags` so the post still surfaces on friends' TAGGED grid.
  const [photoTags, setPhotoTags] = useState<PhotoTag[]>([]);
  const [tagging, setTagging] = useState(false);
  const [track, setTrack] = useState<(MusicTrack & { clipStart?: number }) | null>(null);
  // Opened from a community's camera button → that community starts selected
  // as a post destination (16). All posting rules (geofence etc.) still apply.
  const [communities, setCommunities] = useState<string[]>(() =>
    typeof params.community === "string" && params.community ? [params.community] : []
  );
  const [caption, setCaption] = useState("");
  const [storyOverlayText, setStoryOverlayText] = useState("");
  const [coords, setCoords] = useState<GymSearchCoords | null>(null);
  const [locationSettled, setLocationSettled] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Story music — same picker as daily posts, played during story viewing.
  const [storyTrack, setStoryTrack] = useState<SelectedTrack | null>(null);
  // Friends tagged on the story — rendered as tappable chips in the viewer.
  const [storyTags, setStoryTags] = useState<string[]>([]);
  // Share destination: My Story (id null) or one of the user's private stories.
  const [storyDest, setStoryDest] = useState<StoryDestination>({ id: null, name: "My Story" });

  // ---- Draft system (#23, reworked) ----
  // Multiple drafts, saved ONLY on explicit intent: the "Save as draft" button
  // on the details page, or the keep-as-draft prompt on close. NO autosave —
  // it was silently filing already-posted photos as drafts. The capture screen
  // shows a "Drafts" chip that opens the drafts gallery (/drafts); picking one
  // there hands its id back via the resume mailbox.
  const [draftSummary, setDraftSummary] = useState<{ count: number; previewUri: string | null }>({ count: 0, previewUri: null });
  // The draft currently open in this camera session — posting deletes it.
  const draftIdRef = useRef<string | null>(null);
  const clearDraft = useCallback(() => {
    if (draftIdRef.current) {
      void deleteCameraDrafts(userId, [draftIdRef.current]);
      draftIdRef.current = null;
    }
  }, [userId]);
  const restoreDraft = useCallback((draft: CameraDraft) => {
    draftIdRef.current = draft.id;
    setMode(draft.mode);
    if (draft.mode === "lift") {
      const step = draft.step as LiftStep;
      setLiftStep(["record", "review", "liftmeta", "compose"].includes(step) ? step : "review");
    } else {
      const step = draft.step as DailyStep;
      setDailyStep(["capture", "review", "compose"].includes(step) ? step : "review");
    }
    if (draft.photoUri) setPhotoUri(draft.photoUri);
    if (draft.dualFrontUri) setDualFrontUri(draft.dualFrontUri);
    if (draft.extraPhotos) setExtraPhotos(draft.extraPhotos);
    if (draft.videoUri) setVideoUri(draft.videoUri);
    if (draft.caption) setCaption(draft.caption);
    if (draft.liftExercise) setLiftExercise(draft.liftExercise as LiftExercise);
    if (draft.liftValue) setLiftValue(draft.liftValue);
    if (draft.tags) setTags(draft.tags);
    if (draft.communities) setCommunities(draft.communities);
    if (draft.gym) setGym(draft.gym);
    if (draft.photoTags) setPhotoTags(draft.photoTags);
    if (draft.storyTags) setStoryTags(draft.storyTags);
    if (draft.videoTrim) videoTrimRef.current = draft.videoTrim;
    if (draft.track) {
      const t = draft.track;
      if (draft.mode === "story") setStoryTrack(t as SelectedTrack);
      else setTrack(t as MusicTrack & { clipStart?: number });
    }
  }, []);
  // On every focus: consume a pending resume from the drafts page, otherwise
  // just refresh the chip's count/preview. No interruption on plain opens.
  useEffect(() => {
    if (!isFocused || !userId) return;
    const resumeId = takeDraftResume();
    void loadCameraDrafts(userId).then((drafts) => {
      setDraftSummary({ count: drafts.length, previewUri: drafts[0]?.photoUri ?? null });
      if (resumeId) {
        const draft = drafts.find((d) => d.id === resumeId);
        if (draft) restoreDraft(draft);
      }
    });
  }, [isFocused, userId, restoreDraft]);
  // Everything the draft needs to fully reconstruct this screen.
  const buildDraft = useCallback((): CameraDraftInput => {
    const step = mode === "lift" ? liftStep : dailyStep;
    const activeTrack = mode === "story" ? storyTrack : track;
    return {
      mode,
      step,
      photoUri,
      dualFrontUri,
      extraPhotos,
      videoUri,
      caption,
      track: activeTrack
        ? {
            id: activeTrack.id,
            title: activeTrack.title,
            artist: activeTrack.artist,
            artworkUrl: activeTrack.artworkUrl,
            previewUrl: activeTrack.previewUrl,
            clipStart: activeTrack.clipStart
          }
        : null,
      liftExercise,
      liftValue,
      tags,
      communities,
      gym,
      photoTags,
      storyTags,
      videoTrim: videoTrimRef.current
    };
  }, [mode, dailyStep, liftStep, photoUri, dualFrontUri, extraPhotos, videoUri, caption, track, storyTrack, liftExercise, liftValue, tags, communities, gym, photoTags, storyTags]);

  // Explicitly save the current post as a draft and exit (details-page button).
  // Re-saving a resumed draft updates it in place instead of duplicating.
  const saveAsDraft = useCallback(() => {
    if (!userId) return;
    trackAnalyticsEvent("draft_saved", { mode });
    void saveCameraDraft(userId, buildDraft(), draftIdRef.current).then((id) => {
      draftIdRef.current = id;
    });
    showToast("Saved to drafts");
    router.back();
  }, [userId, buildDraft, router, mode]);

  /**
   * Close the camera. With unposted media in hand, ask once whether to keep it
   * as a draft — so drafts only ever exist on purpose (or via crash autosave).
   */
  const attemptClose = useCallback(() => {
    const step = mode === "lift" ? liftStep : dailyStep;
    const hasMedia = Boolean(photoUri || videoUri);
    // Still on the capture/record screen = nothing worth drafting. (Leftover
    // extraPhotos/dual state after a retake used to trigger the keep-as-draft
    // prompt with no visible shot.)
    if (!hasMedia || step === "capture" || step === "record" || !userId) {
      router.back();
      return;
    }
    if (mode === "story") {
      // Stories are ephemeral — X asks to delete, not to file image options.
      appAlert("Discard this story?", "Your shot and edits will be gone.", [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            clearDraft();
            router.back();
          }
        }
      ]);
      return;
    }
    appAlert("Keep this as a draft?", "Your shot and edits will be here when you come back.", [
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          clearDraft();
          router.back();
        }
      },
      {
        text: "Save draft",
        onPress: () => {
          void saveCameraDraft(userId, buildDraft(), draftIdRef.current);
          router.back();
        }
      },
      { text: "Cancel", style: "cancel" }
    ]);
  }, [photoUri, videoUri, dailyStep, liftStep, userId, mode, buildDraft, clearDraft, router]);

  // Music preview on the story review screen (2d): loop the chosen ~15s segment
  // so the user hears exactly what viewers will, before posting.
  const storyReviewActive = mode === "story" && dailyStep === "review";
  const storyPreview = useAudioPlayer(storyTrack?.previewUrl ? { uri: storyTrack.previewUrl } : null);
  const storyPreviewStatus = useAudioPlayerStatus(storyPreview);
  const storyClipStart = storyTrack?.clipStart ?? 0;
  useEffect(() => {
    // A sheet open on top has its own player (the music picker auditions the
    // song you are about to choose). Pause this one so both are not playing at
    // once; it resumes automatically when the sheet is dismissed.
    if (!storyReviewActive || sheet.isOpen || !storyTrack?.previewUrl || !storyPreviewStatus.isLoaded) {
      try {
        storyPreview.pause();
      } catch {
        // player torn down
      }
      return;
    }
    try {
      void storyPreview.seekTo(storyClipStart);
      storyPreview.play();
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyReviewActive, sheet.isOpen, storyTrack?.previewUrl, storyClipStart, storyPreviewStatus.isLoaded]);
  // Loop just the chosen 15s window.
  useEffect(() => {
    if (!storyReviewActive || sheet.isOpen || !storyTrack?.previewUrl) return;
    if (storyPreviewStatus.currentTime > storyClipStart + 15) {
      try {
        void storyPreview.seekTo(storyClipStart);
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyPreviewStatus.currentTime]);

  useEffect(() => {
    if (Platform.OS !== "web" && permission && !permission.granted && permission.canAskAgain && !permissionAsked.current) {
      permissionAsked.current = true;
      void requestPermission();
    }
  }, [permission, requestPermission]);

  // One-shot location for the gym sheet (nearest gyms first). Never blocks.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let status = await Location.getForegroundPermissionsAsync();
        // Ask AT MOST once per app session — otherwise "Allow once" grants
        // expire and we'd re-prompt on every camera open (the spam bug). If the
        // user hasn't granted after that, fall back silently to no coords.
        if (!status.granted && status.canAskAgain && !locationAskedThisSession) {
          locationAskedThisSession = true;
          status = await Location.requestForegroundPermissionsAsync();
        }
        if (!status.granted) return;
        const position =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!cancelled && position) {
          setCoords({
            latitude: Math.round(position.coords.latitude * 10_000) / 10_000,
            longitude: Math.round(position.coords.longitude * 10_000) / 10_000
          });
        }
      } catch (error) {
        logger.warn("camera_location_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      } finally {
        if (!cancelled) setLocationSettled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setRecordSeconds((seconds) => seconds + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const myCommunities = useMyCommunities();
  const myFriends = useFriends();

  // Geofence: nearest mapped gym (list is nearest-first when we have coords).
  const nearbyGyms = useGymSearch("", coords, locationSettled);
  const nearestGym = (nearbyGyms.data?.pages?.[0] ?? [])[0] as GymSearchResult | undefined;
  const nearestMeters = nearestGym?.distance_meters ?? null;
  const withinGym = nearestMeters != null && nearestMeters <= GYM_GEOFENCE_METERS;
  // The hard rule only gates the daily gym photo, once location has settled —
  // and Home Gym is an explicit exemption: home posts skip the geofence and
  // display "Home Gym" instead of claiming a mapped gym.
  const geofenceBlocked = mode === "daily" && locationSettled && !withinGym && gym?.type !== "home";

  // Pre-select the nearest gym when in range and nothing chosen yet.
  useEffect(() => {
    if (mode === "daily" && locationSettled && withinGym && !gym && nearestGym) {
      setGym({ type: "gym", id: nearestGym.id, name: nearestGym.name });
    }
  }, [mode, locationSettled, withinGym, gym, nearestGym]);

  const liftOption = LIFT_OPTION_BY_ID[liftExercise];
  const liftUnit = liftOption.unit;
  const liftName = liftOption.name;
  const liftNum = Number.parseInt(liftValue || "0", 10);
  const resolvedWeight = liftValue ? `${liftValue} ${liftUnit}` : "";
  const chosenGym = gymName(gym);
  const selectedFriends = (myFriends.data ?? [])
    .filter((friend) => tags.includes(friend.id))
    .map((friend) => ({ id: friend.id, name: friend.display_name, handle: `@${friend.username}` }));
  const selectedCommunities = (myCommunities.data ?? []).filter((community) => communities.includes(community.id));


  /** Flip front/back, debounced so spamming can't outrun the camera session.
   *  Allowed mid-recording (#8) — expo-camera keeps the clip going across the
   *  facing change; we don't reset zoom while recording so the shot isn't jarred. */
  const flipCamera = () => {
    // expo-camera can't switch the capture device mid-recording on iOS — doing
    // so ends the clip. Block the flip while recording instead of losing the take.
    if (recording || dualPhase !== "off") return;
    if (flipLockRef.current) return;
    flipLockRef.current = true;
    setVirtualZoom(0);
    setFacing((value) => (value === "back" ? "front" : "back"));
    setTimeout(() => {
      flipLockRef.current = false;
    }, 650);
  };

  /** Double-tap anywhere on the camera flips (button still works). */
  const handleCameraTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      flipCamera();
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
    }
  };

  /** Pinch-to-zoom over the preview. Pinching out past 1× drops into the
   *  ultra-wide lens (0.5×) on devices that have one. */
  const pinchZoom = Gesture.Pinch()
    .onBegin(() => {
      zoomBaseRef.current = virtualZoom;
    })
    .runOnJS(true)
    .onUpdate((e) => {
      setVirtualZoom((prev) => stepZoom(prev, zoomBaseRef.current + (e.scale - 1) * 0.35));
    });

  const shareStory = () => {
    // Guard against a double-tap posting two stories: shareStory never set the
    // `publishing` flag the button reads, so both taps fired before navigation.
    if (postStory.isPending) {
      return;
    }
    if (!photoUri) {
      appAlert("No photo", "The photo didn't save. Go back and retake it.");
      return;
    }
    // Backstop for the entry gate (e.g. the local day ticked over mid-compose).
    if (postedResolved && !postedToday) {
      appAlert("Post your SPOTTED first", "Stories unlock after you post today's SPOTTED.");
      return;
    }
    const input = {
      photoUri,
      music: storyTrack
        ? {
            title: storyTrack.title,
            artist: storyTrack.artist,
            artworkUrl: storyTrack.artworkUrl,
            previewUrl: storyTrack.previewUrl,
            clipStart: storyTrack.clipStart ?? 0
          }
        : null,
      tagUserIds: storyTags,
      overlayText: storyOverlayText,
      privateStoryId: storyDest.id,
      privateStoryName: storyDest.id ? storyDest.name : null
    };
    // #24: post optimistically — the story shows immediately (optimistic cache
    // insert), we navigate to the feed at once, and the upload retries in the
    // background (retry:3 on the mutation). On final failure we surface a Retry
    // so a story can never silently fail to post.
    const post = () => {
      showToast("Posting…");
      postStory.mutate(input, {
        onSuccess: () => {
          trackAnalyticsEvent("story_published", { dual: Boolean(dualFrontUri) });
          showToast("Added to your story");
          clearDraft();
        },
        onError: (error) => {
          logger.warn("story_publish_failed", { message: error instanceof Error ? error.message : String(error) });
          appAlert("Couldn't post your story", "It didn't upload — poor connection?", [
            { text: "Discard", style: "destructive", onPress: clearDraft },
            { text: "Retry", onPress: post }
          ]);
        }
      });
    };
    post();
    // Clear the draft NOW: mutate-level onSuccess is dropped once this screen
    // unmounts (router.replace below), so the posted story's photo used to
    // linger as a "Resume draft" chip on the next camera open.
    clearDraft();
    setStoryTrack(null);
    setStoryTags([]);
    router.replace("/(tabs)/feed");
    // Optimistic publish burst — the story is already on its way up.
    triggerPostCelebration();
  };

  /** Story mode: pick an existing photo from the library instead of capturing. */
  const pickStoryPhoto = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
        selectionLimit: 1,
        // Skip iOS's transcode step — hand back the current representation so the
        // picker returns fast instead of re-encoding the asset.
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current
      });
      if (result.canceled || !result.assets[0]) return;
      setPhotoUri(result.assets[0].uri);
      setDailyStep("review");
    } catch {
      showToast("Couldn't open your photo library");
    }
  };

  /** Save the daily review exactly as shown. Dual shots are flattened with the
   * selfie inset; regular shots retain the original full-resolution file. */
  const saveDailyPhoto = async () => {
    if (!photoUri || savingToLibrary) return;
    setSavingToLibrary(true);
    try {
      let uri = photoUri;
      if (dualFrontUri && reviewCaptureRef.current) {
        uri = await captureRef(reviewCaptureRef, { format: "jpg", quality: 0.95 });
      }
      const result = await savePhotoToCameraRoll(uri);
      if (result === "saved") {
        trackAnalyticsEvent("photo_saved", { mode: "daily", dual: Boolean(dualFrontUri) });
        showToast("Saved to camera roll");
      }
      else if (result === "denied") showToast("Allow photo access in Settings to save");
      else showToast("Saving photos isn't available on this device");
    } catch {
      showToast("Couldn't save photo");
    } finally {
      setSavingToLibrary(false);
    }
  };

  // Self-timer: one button cycles off → 3s → 5s → 10s → off. With a delay
  // set, the shutter starts a big on-screen countdown; tapping it cancels.
  const [timerSecs, setTimerSecs] = useState<0 | 3 | 5 | 10>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cycleTimer = () => setTimerSecs((t) => (t === 0 ? 3 : t === 3 ? 5 : t === 5 ? 10 : 0));
  const cancelCountdown = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = null;
    setCountdown(null);
  }, []);
  useEffect(() => cancelCountdown, [cancelCountdown]);
  const withTimer = useCallback(
    (capture: () => void) => {
      if (timerSecs === 0 || countdown !== null) {
        capture();
        return;
      }
      let remaining = timerSecs;
      setCountdown(remaining);
      countdownRef.current = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          setCountdown(null);
          capture();
        } else {
          setCountdown(remaining);
        }
      }, 1000);
    },
    [timerSecs, countdown]
  );

  const capturePhoto = useCallback(async () => {
    if (!permission?.granted) {
      // Without camera access there's nothing to capture — re-ask instead of
      // advancing to review with a blank photo.
      if (permission?.canAskAgain) {
        void requestPermission();
      } else {
        showToast("Enable camera access in Settings to post");
      }
      return;
    }
    // Immediate feedback at tap time — capture feels instant even while the
    // file finalizes in the background.
    triggerFlash();
    // Tapping while routed to the lift/video flow drops back to a photo post.
    if (mode === "lift") setMode("daily");
    let uri: string | undefined;
    try {
      // skipProcessing cuts the biggest capture-latency source (EXIF/orientation
      // post-processing) so the shutter feels instant; quality stays high (0.95)
      // so photos are still sharp. No automatic crop — the photo keeps its full
      // frame; cropping is user-driven in the editor.
      const photo = await cameraRef.current?.takePictureAsync({
        quality: mode === "story" ? 0.9 : 0.95,
        skipProcessing: true
      });
      if (photo?.uri) {
        // Flip: the OS un-mirrors front-camera captures; flip back so the saved
        // photo matches the mirrored selfie preview. Crop: daily photos keep
        // only the POST_PHOTO_RATIO band shown between the capture masks, so
        // the feed displays exactly what was framed (WYSIWYG). Stories keep the
        // full frame — they display full-screen. One re-encode covers both.
        // Stories: lighter encode — they're ephemeral and the full-quality
        // mirror re-encode was the "too much delay" on selfie captures.
        uri = await finalizeCapture(photo, {
          mirror: facing === "front",
          ratio: mode === "story" ? null : POST_PHOTO_RATIO,
          compress: mode === "story" ? 0.85 : 0.95,
          // Daily promises WYSIWYG via the crop mask, so drop what the preview
          // hid off the sides too. Stories display full-screen from the same
          // aspect-filled preview, so their frame already matches.
          previewRatio: mode === "story" ? null : winW / winH
        });
      }
    } catch {
      uri = undefined;
    }
    setPhotoUri(uri);
    setDualFrontUri(undefined);
    setDualPhase("off");
    setDailyStep("review");
    if (uri) trackAnalyticsEvent("photo_captured", { mode, dual: false });
    // Stories land directly in edit mode (2a) — no separate "Edit" step. When
    // the editor is done, the review screen (music/tags/share) shows.
    if (mode === "story" && uri) setEditing(true);
  }, [facing, mode, permission?.canAskAgain, permission?.granted, requestPermission, winW, winH]);

  // Dual capture (BeReal-style): grab the current lens, flip, let the session
  // reconfigure, grab the other lens. expo-camera can't run both at once, so
  // this is a fast sequence (~0.7s) rather than a true simultaneous capture.
  const shootOnce = useCallback(
    async (mirror: boolean, ratio: number | null): Promise<string | undefined> => {
      try {
        // 0.95 to match the single-shot path — a dual post's main frame is a
        // full post photo and was being encoded softer than a normal one.
        const photo = await cameraRef.current?.takePictureAsync({ quality: 0.95, skipProcessing: true });
        if (!photo?.uri) return undefined;
        return await finalizeCapture(photo, { mirror, ratio, previewRatio: ratio ? winW / winH : null });
      } catch {
        return undefined;
      }
    },
    [winW, winH]
  );

  const toggleDualMode = useCallback(() => {
    if (dualBusy) return;
    if (dualPhase !== "off") {
      setDualPhase("off");
      setDualFrontUri(undefined);
      setFacing("back");
      setVirtualZoom(0);
      return;
    }
    if (!permission?.granted) {
      if (permission?.canAskAgain) void requestPermission();
      else showToast("Enable camera access in Settings to post");
      return;
    }
    setDualFrontUri(undefined);
    setVirtualZoom(0);
    videoReadyRef.current = false;
    setFacing("front");
    setDualPhase("selfie");
    trackAnalyticsEvent("dual_mode_started", { mode });
  }, [dualBusy, dualPhase, mode, permission?.canAskAgain, permission?.granted, requestPermission]);

  const captureDualStep = useCallback(async () => {
    if (dualBusy || dualPhase === "off") return;
    setDualBusy(true);
    triggerFlash();
    try {
      if (dualPhase === "selfie") {
        // Daily dual: the selfie lands in the 3:4 inset frame — crop to match.
        const front = await shootOnce(true, mode === "daily" ? INSET_RATIO : null);
        if (!front) {
          showToast("Couldn't capture the selfie — try again");
          return;
        }
        setDualFrontUri(front);
        videoReadyRef.current = false;
        setFacing("back");
        setVirtualZoom(0);
        setDualPhase("main");
        // Keep the shutter disabled while the rear session reconfigures.
        const flipStart = Date.now();
        while (!videoReadyRef.current && Date.now() - flipStart < 1600) {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        return;
      }
      const back = await shootOnce(false, mode === "daily" ? POST_PHOTO_RATIO : null);
      if (!back) {
        showToast("Couldn't take the dual shot — try again");
        return;
      }
      setPhotoUri(back);
      setDualPhase("off");
      setDailyStep("review");
      trackAnalyticsEvent("photo_captured", { mode, dual: true });
      if (mode === "story") setEditing(true);
    } finally {
      setDualBusy(false);
    }
  }, [dualBusy, dualPhase, mode, shootOnce]);

  // Snapchat-style capture: tap = photo (capturePhoto), hold = video. Holding
  // records; sliding onto the lock keeps it recording hands-free. A recorded
  // clip routes to the video review → compose → publish flow.
  const startRecording = () => {
    if (!permission?.granted) {
      if (permission?.canAskAgain) void requestPermission();
      else showToast("Enable camera access in Settings to record");
      return;
    }
    // Ask for the mic on the first hold so the clip has sound (denied = muted).
    if (!micPermission?.granted && micPermission?.canAskAgain) {
      void requestMicPermission();
    }
    setRecordSeconds(0);
    setRecordLocked(false);
    // Pin the current lens for the whole take.
    recordUltraRef.current = Boolean(ultraLens) && virtualZoom < 0;
    setRecording(true);
    // Daily sits in picture mode for image quality, so a hold has to bring a
    // video session up first. Clear the ready flag BEFORE requesting the flip —
    // otherwise the wait loop below reads the outgoing session's `true` and
    // calls recordAsync mid-reconfigure. Story/lift are already in video mode,
    // so nothing remounts and recording still starts immediately.
    if (camMode !== "video") {
      videoReadyRef.current = false;
      setRecordIntent(true);
    }
    void impactHaptic(); // #12: haptic on record start
    void (async () => {
      try {
        const start = Date.now();
        while (!videoReadyRef.current && Date.now() - start < 1500) {
          await new Promise((resolve) => setTimeout(resolve, 25));
        }
        const result = await cameraRef.current?.recordAsync({ maxDuration: 60 });
        if (result?.uri) {
          videoTrimRef.current = null;
          setVideoUri(result.uri);
          // Daily video stays in the daily flow (photo carousel becomes a clip);
          // story/lift holds route to the lift review as before.
          if (mode === "daily") {
            setDailyStep("review");
          } else {
            setMode("lift");
            setLiftStep("review");
          }
        } else {
          showToast("Recording didn't save — try again");
        }
      } catch (error) {
        logger.warn("record_failed", { message: error instanceof Error ? error.message : String(error) });
        showToast("Couldn't record — try again");
      } finally {
        setRecording(false);
        setRecordLocked(false);
        setFinalizing(false);
        // Back to the photo pipeline for the next tap.
        setRecordIntent(false);
      }
    })();
  };

  // Release-to-stop responds the instant the finger lifts (#2): the screen
  // flips to a "saving clip" state immediately; recordAsync resolves as soon
  // as the encoder finishes the file.
  const stopRecording = () => {
    void impactHaptic(); // #12: haptic on record stop
    setFinalizing(true);
    cameraRef.current?.stopRecording();
  };

  const chooseGym = (next: SelectedGym) => {
    setGym(next);
    setCommunities((ids) => ids.filter((id) => {
      const community = (myCommunities.data ?? []).find((item) => item.id === id);
      return !community || community.type !== "gym" || (next.type === "gym" && community.gym_id === next.id);
    }));
    sheet.close();
  };

  const openGymSheet = () => {
    sheet.open(
      <GymSheet selected={gym} coords={coords} locationSettled={locationSettled} onSelect={chooseGym} />
    );
  };

  const submitPost = () => {
    if (geofenceBlocked) {
      trackAnalyticsEvent("gym_geofence_blocked");
      showToast("Be at a gym to post — or pick Custom location");
      return;
    }
    if (!gym) {
      showToast("Choose a gym or location first");
      openGymSheet();
      return;
    }
    void publish();
  };

  const publish = async () => {
    if (mode !== "daily") {
      // Max-lift video — real upload + post row (was a mock toast before).
      if (!isSupabaseConfigured || !userId) {
        showToast("Video posted");
        router.back();
        return;
      }
      if (!videoUri) {
        appAlert("No video", "The clip didn't save. Go back and retake it.");
        return;
      }
      const logged = liftNum > 0;
      setPublishing(true);
      try {
        const postId = await publishLiftVideo({
          userId,
          videoUri,
          trimStart: videoTrimRef.current?.start ?? null,
          trimEnd: videoTrimRef.current?.end ?? null,
          liftName,
          liftWeight: resolvedWeight,
          liftExercise: logged ? liftExercise : null,
          liftValue: logged ? liftNum : null,
          liftUnit: logged ? liftUnit : null,
          caption,
          gymId: gym?.type === "gym" ? gym.id : null,
          locationKind: gym?.type ?? "other"
        });
        // Posting is the unlock trigger: record the lift, then celebrate any
        // newly-crossed tiers (cascade includes all lower ones).
        let unlockedData: TrophyShareData | null = null;
        if (logged) {
          const oldBest = userLifts.data?.[liftExercise] ?? 0;
          await logLift.mutateAsync({ userId, exercise: liftExercise, value: liftNum, unit: liftUnit, postId }).catch(() => {});
          const crossed = newlyUnlockedTiers(liftExercise, oldBest, liftNum);
          if (crossed.length > 0) {
            const top = crossed[0];
            unlockedData = {
              icon: liftOption.def.icon,
              name: top.name,
              familyName: liftOption.name,
              earnedAt: new Date().toISOString(),
              rarityPct: top.rarityPct
            };
          }
        }
        await invalidateAfterPostChange(queryClient);
        await queryClient.invalidateQueries({ queryKey: ["user-lifts", userId] });
        clearDraft(); // #23: posted successfully — drop the draft
        // Trophy celebrations come from TrophyEarnHost (realtime on
        // user_trophies) — every tier, every time, wherever you are.
        router.replace("/(tabs)/feed");
        if (!unlockedData) triggerPostCelebration();
      } catch (error) {
        logger.warn("lift_publish_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
        appAlert("Couldn't post", "Something went wrong uploading your video. Check your connection and try again.");
      } finally {
        setPublishing(false);
      }
      return;
    }
    if (!isSupabaseConfigured || !userId) {
      markPostedToday();
      showToast("Posted. Feed unlocked.");
      router.replace("/(tabs)/feed");
      return;
    }
    if (!photoUri && !videoUri) {
      appAlert("No media", "The shot didn't save. Go back and retake it.");
      return;
    }
    setPublishing(true);
    // Music is stored in its own columns; the caption carries text + friend tags.
    const captionForPost = [caption.trim(), selectedFriends.map((friend) => friend.handle).join(" ")]
      .filter(Boolean)
      .join(" ");
    const publishInput = {
      userId,
      photoUris: photoUri ? [...extraPhotos, photoUri] : [],
      videoUri: videoUri ?? null,
      insetUri: dualFrontUri ?? null,
      caption: captionForPost,
      gymId: gym?.type === "gym" ? gym.id : null,
      locationKind: gym?.type ?? ("other" as const),
      musicTitle: track?.title ?? null,
      musicArtist: track?.artist ?? null,
      musicPreviewUrl: track?.previewUrl ?? null,
      musicArtworkUrl: track?.artworkUrl ?? null,
      musicClipStart: track?.clipStart ?? 0
    };
    // Everything that rides along with the post (friend tags, photo tags,
    // workout attach, community cross-posts) — shared with the offline queue.
    const publishExtras = {
      userId,
      tags,
      photoTags: photoTags.map((t) => ({ userId: t.userId, x: t.x, y: t.y })),
      workoutId: typeof params.workout === "string" && params.workout ? params.workout : null,
      communityIds: selectedCommunities
        .filter((community) => community.type !== "gym" || (gym?.type === "gym" && community.gym_id === gym.id))
        .map((community) => community.id)
    };
    try {
      const postId = await publishDailyPost(publishInput);
      await attachDailyPostExtras(postId, publishExtras);
      markPostedToday();
      trackAnalyticsEvent("daily_post_published", {
        dual: Boolean(dualFrontUri),
        photo_count: publishInput.photoUris.length,
        is_video: Boolean(videoUri),
        has_music: Boolean(track),
        has_workout: Boolean(publishExtras.workoutId),
        tagged_count: tags.length + photoTags.length,
        location_kind: gym?.type ?? "other"
      });
      // Feed AND your own profile (grid, post count, streak calendar) — the
      // profile used to keep serving its pre-post list.
      await invalidateAfterPostChange(queryClient);
      // Tagged friends' TAGGED grids refresh without waiting for pull-to-refresh.
      if (tags.length) void queryClient.invalidateQueries({ queryKey: ["tagged-posts"] });
      clearDraft(); // #23: posted successfully — drop the draft
      router.replace("/(tabs)/feed");
      // Publish burst plays over the feed as it lands.
      triggerPostCelebration();
    } catch (error) {
      logger.warn("daily_post_publish_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      if (isNetworkError(error)) {
        // No connection (gym dead zone) — park the post in the offline queue.
        // It uploads automatically when connectivity returns; the feed unlocks
        // NOW so the app stays usable offline (Instagram/Snapchat behavior).
        try {
          await enqueueDailyPost({ input: publishInput, ...publishExtras });
          markPostedToday();
          trackAnalyticsEvent("daily_post_queued_offline", { dual: Boolean(dualFrontUri) });
          clearDraft(); // media was copied to the pending dir before this
          router.replace("/(tabs)/feed");
          showToast("No connection — your post will upload automatically");
        } catch (queueError) {
          logger.warn("daily_post_queue_failed", {
            message: queueError instanceof Error ? queueError.message : String(queueError)
          });
          appAlert("Couldn't post", "You're offline and the post couldn't be saved. Try again in a moment.");
        }
      } else {
        appAlert("Couldn't post", "Something went wrong uploading your photo. Check your connection and try again.");
      }
    } finally {
      setPublishing(false);
    }
  };

  // Photo editor — stories AND daily posts. The boundary keeps any editor crash
  // from taking down the app: worst case you're back on preview.
  if (editing && photoUri) {
    return (
      <EditorBoundary onClose={() => setEditing(false)}>
        <PhotoEditor
          uri={photoUri}
          // Both modes SHOW the dual selfie so you can compose around it, but
          // only a story bakes it into the pixels. A daily post uploads it
          // separately as inset_url and the feed draws the PIP from there —
          // baking it here as well would show the same selfie twice.
          insetUri={dualFrontUri}
          bakeInset={mode === "story"}
          onDone={(edited, overlayText) => {
            setPhotoUri(edited);
            setStoryOverlayText(overlayText);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </EditorBoundary>
    );
  }

  // Positional photo tagging (M1) — full-screen over the compose.
  if (tagging && photoUri) {
    return (
      <PhotoTagOverlay
        uri={photoUri}
        initial={photoTags}
        onClose={() => setTagging(false)}
        onDone={(next) => {
          setPhotoTags(next);
          setTags(next.map((t) => t.userId));
          setTagging(false);
        }}
      />
    );
  }

  const isCapture = mode === "lift" ? liftStep === "record" : dailyStep === "capture";

  if (isCapture) {
    const dualMode = dualPhase !== "off";
    // WYSIWYG capture band (daily): the 9:16 sensor frame cover-fills the
    // screen; the post keeps only the central POST_PHOTO_RATIO band of it.
    // Dim everything outside that band so the framing is honest — what's
    // bright is exactly what posts.
    // The preview aspect-fills, so the visible width is always the full screen
    // width whatever the session preset is — which makes the kept band simply
    // "screen width at the post ratio", with no sensor-ratio term. (The old
    // formula hard-coded the 16:9 video session and ignored the hidden sides,
    // so it under-reported the mask and broke outright in a 4:3 photo session.)
    const keptH = winW / POST_PHOTO_RATIO;
    const cropMaskH = Math.max(0, Math.round((winH - keptH) / 2));
    const showCropMask = mode === "daily" && dualPhase !== "selfie" && cropMaskH > 0;
    const stepLabel =
      dualPhase === "selfie"
        ? "DUAL · SELFIE"
        : dualPhase === "main"
          ? "DUAL · MAIN"
          : mode === "lift"
            ? "VIDEO"
            : mode === "story"
              ? "STORY"
              : "TODAY'S PHOTO";
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        {permission?.granted && isFocused ? (
          <GestureDetector gesture={pinchZoom}>
            <View style={{ position: "absolute", inset: 0, backgroundColor: colors.graphite }}>
              <CameraView
                // Remount on mode change (onCameraReady re-fires for the new
                // video session) AND on every screen refocus (fresh native
                // session — the frozen-preview fix).
                key={`${camMode}-${camEpoch}`}
                ref={cameraRef}
                facing={facing}
                mode={camMode}
                zoom={cameraZoom}
                // Ultra-wide (0.5×) when pinched out past 1× — iOS devices with
                // the lens only; elsewhere zoom bottoms out at 1×.
                selectedLens={ultraActive && ultraLens ? ultraLens : undefined}
                mute={!micPermission?.granted}
                videoQuality="1080p"
                // Flash rules + shutter animation live in the shared kit so the
                // daily, story, chat and reaction cameras can never drift.
                {...cameraSurfaceProps({ flashOn, facing, videoMode: camMode === "video", recording })}
                onCameraReady={() => {
                  videoReadyRef.current = true;
                  // Discover lenses (ultra-wide availability) for this facing.
                  void cameraRef.current
                    ?.getAvailableLensesAsync()
                    .then(setAvailableLenses)
                    .catch(() => setAvailableLenses([]));
                }}
                style={
                  dualPhase === "selfie"
                    ? {
                        position: "absolute",
                        top: insets.top + 76,
                        left: 16,
                        width: "32%",
                        aspectRatio: 3 / 4,
                        borderRadius: 16,
                        overflow: "hidden",
                        borderWidth: 2,
                        borderColor: colors.white
                      }
                    : { position: "absolute", inset: 0 }
                }
              />
              {dualPhase === "main" && dualFrontUri ? (
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: insets.top + 76,
                    left: 16,
                    width: "32%",
                    aspectRatio: 3 / 4,
                    borderRadius: 16,
                    overflow: "hidden",
                    borderWidth: 2,
                    borderColor: colors.white,
                    backgroundColor: colors.black
                  }}
                >
                  <ExpoImage source={{ uri: dualFrontUri }} contentFit="cover" style={{ flex: 1 }} />
                </View>
              ) : null}
              {dualPhase === "selfie" ? (
                <View
                  pointerEvents="none"
                  style={{ position: "absolute", top: "43%", left: 32, right: 32, alignItems: "center", gap: 8 }}
                >
                  <Text style={{ fontFamily: "Geist_700Bold", fontSize: 18, color: colors.white, textAlign: "center" }}>
                    Frame your selfie
                  </Text>
                  <Text style={{ fontFamily: "Geist_400Regular", fontSize: 13, lineHeight: 19, color: colors.fog, textAlign: "center" }}>
                    Tap the shutter to lock the inset, then frame the main photo.
                  </Text>
                </View>
              ) : null}
              {/* Double-tap to flip — behind the controls so buttons still work. */}
              <Pressable
                onPress={handleCameraTap}
                style={{ position: "absolute", inset: 0 }}
                accessibilityLabel="Double tap to switch camera"
              >
                <View style={{ flex: 1 }} />
              </Pressable>
              {/* Daily crop band — the dimmed strips fall outside the posted frame. */}
              {showCropMask ? (
                <>
                  <View
                    pointerEvents="none"
                    style={{ position: "absolute", top: 0, left: 0, right: 0, height: cropMaskH, backgroundColor: "rgba(0,0,0,0.55)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.28)" }}
                  />
                  <View
                    pointerEvents="none"
                    style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: cropMaskH, backgroundColor: "rgba(0,0,0,0.55)", borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.28)" }}
                  />
                </>
              ) : null}
              {/* Selfie "flash": misty white screen ring + brightness slider. */}
              {flashOn && facing === "front" ? <FrontFlash /> : null}
            </View>
          </GestureDetector>
        ) : (
          <Pressable
            onPress={() => { if (permission?.canAskAgain) void requestPermission(); }}
            style={{ position: "absolute", inset: 0, backgroundColor: colors.graphite }}
            accessibilityLabel="Request camera permission"
          >
            <View style={{ flex: 1 }} />
          </Pressable>
        )}
        {/* Zoom readout — "0.5×" in ultra-wide, "N.Nx" while zoomed in. */}
        {ultraActive || cameraZoom > 0.01 ? (
          <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 60, alignSelf: "center", paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)" }}>
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 11, color: colors.white }}>
              {`${zoomLabel.toFixed(1)}x`}
            </Text>
          </View>
        ) : null}

        <View
          style={{
            position: "absolute",
            top: insets.top + 8,
            left: 16,
            right: 16,
            flexDirection: "row",
            // Top-aligned so the vertical control stack grows downward while
            // the close button + step pill hold the top line.
            alignItems: "flex-start",
            justifyContent: "space-between"
          }}
        >
          <CircleButton label="Close camera" onPress={attemptClose}>
            <X color={colors.white} size={20} strokeWidth={2.2} />
          </CircleButton>
          <View style={{ paddingTop: 8 }}>
            <StepPill>{stepLabel}</StepPill>
          </View>
          {/* Camera options — VERTICAL stack down the top-right edge:
              flip on top, dual at the bottom. */}
          <View style={{ flexDirection: "column", gap: 12 }}>
            {!dualMode ? (
              <CircleButton label="Flip camera" onPress={flipCamera}>
                <RefreshCw color={colors.white} size={19} strokeWidth={2} />
              </CircleButton>
            ) : null}
            <CircleButton label={flashOn ? "Flash on" : "Flash off"} onPress={() => setFlashOn((v) => !v)}>
              {flashOn ? <Zap color={tokens.accent.gold} size={19} strokeWidth={2} fill={tokens.accent.gold} /> : <ZapOff color={colors.white} size={19} strokeWidth={2} />}
            </CircleButton>
            {/* Self-timer: cycles off → 3s → 5s → 10s → off. */}
            {!recording ? (
              <CircleButton
                label={timerSecs ? `Photo timer, ${timerSecs} seconds` : "Photo timer off"}
                onPress={cycleTimer}
              >
                {timerSecs ? (
                  <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13, color: tokens.accent.gold }}>{`${timerSecs}s`}</Text>
                ) : (
                  <TimerIcon color={colors.white} size={19} strokeWidth={2} />
                )}
              </CircleButton>
            ) : null}
            {/* Dual (BeReal-style front+back) for daily and story photos. */}
            {!recording && mode !== "lift" ? (
              <CircleButton label={dualMode ? "Exit dual camera" : "Enter dual camera"} onPress={toggleDualMode}>
                {dualBusy ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <DualCameraIcon active={dualMode} />
                )}
              </CircleButton>
            ) : null}
          </View>
        </View>

        {/* Timer countdown — big center numeral; tap anywhere on it to cancel. */}
        {countdown !== null ? (
          <Pressable
            onPress={cancelCountdown}
            accessibilityLabel={`Timer: ${countdown}. Tap to cancel`}
            style={{ position: "absolute", inset: 0, alignItems: "center", justifyContent: "center" }}
          >
            <Text
              style={{
                fontFamily: "Boldonse_400Regular",
                fontSize: 110,
                color: colors.white,
                textShadowColor: "rgba(0,0,0,0.7)",
                textShadowOffset: { width: 0, height: 2 },
                textShadowRadius: 12
              }}
            >
              {countdown}
            </Text>
          </Pressable>
        ) : null}

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.7)"]}
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 280 }}
        />
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: insets.bottom + 40,
            alignItems: "center",
            gap: 16
          }}
        >
          {/* Drafts — non-blocking entry point to the drafts gallery. Never
              interrupts a fresh shot. */}
          {draftSummary.count > 0 && !photoUri && !videoUri && !recording ? (
            <Pressable accessibilityLabel="Open drafts" onPress={() => router.push("/drafts")}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  paddingVertical: 6,
                  paddingLeft: 7,
                  paddingRight: 14,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: colors.slate,
                  backgroundColor: "rgba(0,0,0,0.6)"
                }}
              >
                {draftSummary.previewUri ? (
                  <ExpoImage
                    source={{ uri: draftSummary.previewUri }}
                    contentFit="cover"
                    style={{ width: 26, height: 26, borderRadius: 13 }}
                  />
                ) : (
                  <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.graphite, alignItems: "center", justifyContent: "center" }}>
                    <ImageIcon size={14} color={colors.mist} strokeWidth={2} />
                  </View>
                )}
                <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.white }}>
                  {draftSummary.count === 1 ? "Drafts" : `Drafts (${draftSummary.count})`}
                </Text>
              </View>
            </Pressable>
          ) : null}
          {recording ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingVertical: 6,
                paddingHorizontal: 14,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: colors.slate,
                backgroundColor: "rgba(0,0,0,0.6)"
              }}
            >
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" }} />
              <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 12, color: colors.white }}>
                {`0:${String(recordSeconds).padStart(2, "0")}`}
                {recordLocked ? "  ·  LOCKED" : ""}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 34 }}>
            {/* Library picker — story mode only (Snapchat-style). Hidden while recording. */}
            {mode === "story" && !recording ? (
              <CircleButton label="Choose from library" onPress={() => void pickStoryPhoto()}>
                <ImageIcon color={colors.white} size={19} strokeWidth={2} />
              </CircleButton>
            ) : (
              <View style={{ width: 40 }} />
            )}
            <ShutterButton
              recording={recording}
              locked={recordLocked}
              disabled={dualBusy || finalizing}
              allowRecording={!dualMode}
              progress={recordSeconds / 60}
              onTap={() => withTimer(() => void (dualMode ? captureDualStep() : capturePhoto()))}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onLock={() => {
                setRecordLocked(true);
                void impactHaptic(); // #12: haptic on lock
              }}
              // #6: slide up/down on the button while holding to zoom.
              onZoomDelta={(dy) => setVirtualZoom((z) => stepZoom(z, z - dy / 240))}
            />
            {/* Spacer to keep the shutter centered. */}
            <View style={{ width: 40 }} />
          </View>
          {recording ? (
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 1, color: "rgba(255,255,255,0.75)" }}>
              {recordLocked ? "TAP TO STOP" : "SLIDE TO LOCK"}
            </Text>
          ) : dualPhase === "selfie" ? (
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, letterSpacing: 0.8, color: "rgba(255,255,255,0.7)" }}>
              TAP TO LOCK SELFIE
            </Text>
          ) : dualPhase === "main" ? (
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, letterSpacing: 0.8, color: "rgba(255,255,255,0.7)" }}>
              TAP TO TAKE DUAL PHOTO
            </Text>
          ) : (
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, letterSpacing: 0.8, color: "rgba(255,255,255,0.55)" }}>
              {"TAP FOR PHOTO \u00b7 HOLD FOR VIDEO"}
            </Text>
          )}
        </View>

        {/* Perceived-instant stop (#2): the moment the finger lifts, the screen
            responds \u2014 the encoder finishes the file underneath. */}
        {finalizing ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <ActivityIndicator color={colors.white} />
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, letterSpacing: 1, color: colors.mist }}>
              SAVING CLIP
            </Text>
          </View>
        ) : null}
      </View>
    );
  }

  if ((mode === "daily" || mode === "story") && dailyStep === "review") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        {/* Full-bleed shot \u2014 tap it to (re)open the editor (2a). */}
        {mode === "story" ? (
          <Pressable
            onPress={() => setEditing(true)}
            accessibilityLabel="Tap photo to edit"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          >
            <ScenePhoto uri={photoUri} scene="s2" legibility={false} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
          </Pressable>
        ) : videoUri ? (
          <LiftVideoThumb uri={videoUri} />
        ) : (
          /* Daily photo at its posted ratio (the capture crop) — review shows
             exactly the frame the feed will show, letterboxed on black. */
          <View style={{ position: "absolute", inset: 0, backgroundColor: colors.black, justifyContent: "center" }}>
            <View
              ref={reviewCaptureRef}
              collapsable={false}
              style={{ width: "100%", aspectRatio: POST_PHOTO_RATIO, overflow: "hidden", backgroundColor: colors.black }}
            >
              {/* Tap to edit, same as a story (2a). Dual posts included: the
                  editor shows the PIP but does not bake it, so the selfie is
                  still stored once in inset_url. */}
              <Pressable
                onPress={() => setEditing(true)}
                accessibilityLabel="Tap photo to edit"
                style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
              >
                <ScenePhoto
                  uri={photoUri}
                  scene="s2"
                  legibility={false}
                  style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
                />
              </Pressable>
              {/* Dual-camera front frame — placed like the feed inset (12/12, 31%). */}
              {dualFrontUri ? (
                <View pointerEvents="none" style={{ position: "absolute", top: 12, left: 12, width: "31%", aspectRatio: 3 / 4, borderRadius: 12, overflow: "hidden", borderWidth: 2, borderColor: colors.black }}>
                  <ExpoImage source={{ uri: dualFrontUri }} contentFit="cover" style={{ flex: 1 }} />
                </View>
              ) : null}
            </View>
          </View>
        )}

        <LinearGradient
          colors={["rgba(0,0,0,0.55)", "transparent"]}
          pointerEvents="none"
          style={{ position: "absolute", top: 0, left: 0, right: 0, height: insets.top + 90 }}
        />
        <View
          style={{
            position: "absolute",
            top: insets.top + 8,
            left: 16,
            right: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <CircleButton
            label="Retake"
            onPress={() => {
              // A dual retake keeps the framed selfie and returns to the rear
              // preview; a video retake simply clears the clip.
              if (videoUri) setVideoUri(undefined);
              if (dualFrontUri) {
                setPhotoUri(undefined);
                setFacing("back");
                setDualPhase("main");
              }
              setDailyStep("capture");
            }}
          >
            <ChevronLeft color={colors.white} size={20} />
          </CircleButton>
          <StepPill>{mode === "story" ? "STORY" : "YOUR SHOT"}</StepPill>
          {mode === "story" ? (
            // Edit is tap-the-photo now (2a); this stays a lightweight affordance.
            <Pressable onPress={() => setEditing(true)} accessibilityLabel="Edit story" hitSlop={8}>
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center" }}>
                <Pencil size={18} color={colors.white} strokeWidth={2.2} />
              </View>
            </Pressable>
          ) : !videoUri && !dualFrontUri && extraPhotos.length + 1 < 4 ? (
            /* Multi-photo: bank this shot and go take another (carousel post).
               Hidden for video daily posts — a clip stands alone. */
            <Pressable
              onPress={() => {
                if (!photoUri) return;
                setExtraPhotos((prev) => [...prev, photoUri]);
                setPhotoUri(undefined);
                setDailyStep("capture");
              }}
              accessibilityLabel="Add another photo"
            >
              <View style={{ height: 40, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.45)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Plus size={15} color={colors.white} strokeWidth={2.4} />
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 13, color: colors.white }}>
                  {extraPhotos.length ? `${extraPhotos.length + 1}/4` : "Add"}
                </Text>
              </View>
            </Pressable>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.75)"]}
          pointerEvents="none"
          style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 220 }}
        />
        <View style={{ position: "absolute", left: 18, right: 18, bottom: insets.bottom + 22 }}>
          {mode === "story" ? (
            <>
              {/* Destination pill — My Story vs a private story (create/edit inside). */}
              <Pressable
                onPress={() => sheet.open(<StoryDestinationSheet selected={storyDest} onSelect={setStoryDest} />)}
                accessibilityLabel={`Sharing to ${storyDest.name} — change destination`}
                style={{ alignSelf: "center", marginBottom: 12 }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: storyDest.id ? tokens.accent.gold : colors.slate,
                    backgroundColor: "rgba(0,0,0,0.5)"
                  }}
                >
                  {storyDest.id ? (
                    <Lock size={14} color={tokens.accent.gold} strokeWidth={2} />
                  ) : (
                    <Users size={14} color={colors.white} strokeWidth={2} />
                  )}
                  <Text
                    numberOfLines={1}
                    style={{
                      maxWidth: 220,
                      fontFamily: "Geist_600SemiBold",
                      fontSize: 12.5,
                      color: storyDest.id ? tokens.accent.gold : colors.white
                    }}
                  >
                    {storyDest.id ? `Private · ${storyDest.name}` : "Sharing to My Story"}
                  </Text>
                </View>
              </Pressable>
              {/* Music pill — same catalog picker as daily posts. */}
              <Pressable
                onPress={() =>
                  sheet.open(
                    <MusicSheet
                      selected={storyTrack}
                      onChange={setStoryTrack}
                      onSelect={(next) => {
                        setStoryTrack(next);
                        sheet.close();
                      }}
                    />
                  )
                }
                accessibilityLabel="Add music to story"
                style={{ alignSelf: "center", marginBottom: 12 }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.slate,
                    backgroundColor: "rgba(0,0,0,0.5)"
                  }}
                >
                  <Music size={14} color={colors.white} strokeWidth={2} />
                  <Text numberOfLines={1} style={{ maxWidth: 220, fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.white }}>
                    {storyTrack ? `${storyTrack.title} · ${storyTrack.artist}` : "Add music"}
                  </Text>
                </View>
              </Pressable>
              {/* Tag friends pill — same picker as posts; renders tappable chips in the viewer. */}
              <Pressable
                onPress={() => sheet.open(<FriendsSheet initial={storyTags} onDone={setStoryTags} />)}
                accessibilityLabel="Tag friends on story"
                style={{ alignSelf: "center", marginBottom: 12 }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: colors.slate,
                    backgroundColor: "rgba(0,0,0,0.5)"
                  }}
                >
                  <Tag size={14} color={colors.white} strokeWidth={2} />
                  <Text numberOfLines={1} style={{ maxWidth: 220, fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.white }}>
                    {storyTags.length ? `${storyTags.length} tagged` : "Tag friends"}
                  </Text>
                </View>
              </Pressable>
              <Button
                onPress={() => void shareStory()}
                loading={publishing || postStory.isPending}
                disabled={publishing || postStory.isPending}
              >
                {storyDest.id ? `Share to ${storyDest.name}` : "Share to story"}
              </Button>
            </>
          ) : (
            <View style={{ flexDirection: "row", alignItems: "stretch", gap: 10 }}>
              {photoUri && !videoUri ? (
                <Button
                  variant="ghost"
                  onPress={() => void saveDailyPhoto()}
                  loading={savingToLibrary}
                  disabled={savingToLibrary}
                  icon={<Download size={18} color={colors.bone} strokeWidth={2.2} />}
                  style={{ minWidth: 104 }}
                >
                  Save
                </Button>
              ) : null}
              <View style={{ flex: 1 }}>
                <Button onPress={() => setDailyStep("compose")} style={{ flex: 1 }}>
                  Continue {"\u203a"}
                </Button>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }

  if (mode === "lift" && liftStep === "review") {
    const retake = () => {
      setVideoUri(undefined);
      setLiftStep("record");
      setFacing("back");
    };
    if (!videoUri) {
      // No saved clip (record failed or state got here early) — offer the way back.
      return (
        <View style={{ flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
          <Text style={{ fontFamily: "Geist_400Regular", fontSize: 13.5, color: colors.fog, textAlign: "center" }}>
            No clip saved. Record it again.
          </Text>
          <View style={{ marginTop: 20, alignSelf: "stretch" }}>
            <Button onPress={retake}>Back to camera</Button>
          </View>
        </View>
      );
    }
    return (
      <EditorBoundary onClose={retake}>
        <LiftVideoReview
          uri={videoUri}
          onRetake={retake}
          onContinue={(trim) => {
            videoTrimRef.current = trim;
            setLiftStep("liftmeta");
          }}
        />
      </EditorBoundary>
    );
  }

  if (mode === "lift" && liftStep === "liftmeta") {
    return (
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.black }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
          <PanelHeader title="Log your lift" onBack={() => { setLiftStep("review"); setFacing("back"); }} />
          <MediaPreview mode="lift" videoUri={videoUri} lift={liftName} weight={resolvedWeight} width="62%" />
          <Text style={{ paddingHorizontal: 18, paddingTop: 12, fontSize: 12.5, lineHeight: 18, color: colors.fog }}>
            Enter what you hit — posting checks it against your trophies. Your friends see the video, so keep it honest.
          </Text>
          <SectionLabel>Exercise</SectionLabel>
          {LIFT_OPTIONS.map((opt) => (
            <ChoiceRow
              key={opt.id}
              title={opt.name}
              sub={opt.unit === "lb" ? "Weight (lb)" : "Reps"}
              selected={liftExercise === opt.id}
              onPress={() => { setLiftExercise(opt.id); setLiftValue(""); }}
            />
          ))}
          <SectionLabel>{liftUnit === "lb" ? "Weight (lb)" : "Reps"}</SectionLabel>
          <View style={{ paddingHorizontal: 18 }}>
            <TextInput
              value={liftValue}
              onChangeText={(value) => setLiftValue(value.replace(/[^0-9]/g, "").slice(0, 4))}
              keyboardType="number-pad"
              returnKeyType="done"
              // #17: the number pad has no return key on iOS — add a Done bar.
              inputAccessoryViewID={Platform.OS === "ios" ? "weightDone" : undefined}
              onSubmitEditing={() => Keyboard.dismiss()}
              placeholder={liftUnit === "lb" ? "e.g. 225" : "e.g. 12"}
              placeholderTextColor={colors.fog}
              style={{
                minHeight: 52,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: liftValue ? colors.slate : colors.iron,
                backgroundColor: colors.graphite,
                paddingHorizontal: 16,
                fontFamily: "Geist_700Bold",
                fontSize: 22,
                color: colors.white
              }}
            />
          </View>
          <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
            <Button disabled={liftNum <= 0} onPress={() => setLiftStep("compose")}>Continue</Button>
          </View>
        </ScrollView>
        {Platform.OS === "ios" ? (
          <InputAccessoryView nativeID="weightDone">
            <View style={{ flexDirection: "row", justifyContent: "flex-end", backgroundColor: colors.ink, borderTopWidth: 1, borderTopColor: colors.iron, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Pressable onPress={() => Keyboard.dismiss()} accessibilityLabel="Done entering weight">
                <View style={{ paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white }}>
                  <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.black }}>Done</Text>
                </View>
              </Pressable>
            </View>
          </InputAccessoryView>
        ) : null}
      </KeyboardAvoidingView>
    );
  }

  return (
    // ONE keyboard compensation only: iOS uses the ScrollView's automatic
    // keyboard insets (which scrolls the focused caption just above the
    // keyboard); Android uses KAV height + adjustResize. Stacking KAV padding
    // + insets + a manual scrollToEnd previously triple-shifted the content
    // and threw the caption box past the top of the screen.
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.black }}
      behavior={Platform.OS === "ios" ? undefined : "height"}
    >
      <ScrollView
        ref={shareScrollRef}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        contentContainerStyle={{ paddingBottom: keyboardVisible ? 12 : insets.bottom + 28 }}
      >
        <PanelHeader
          title={mode === "daily" ? "Today's post" : "Video"}
          onBack={() => mode === "daily" ? setDailyStep("review") : setLiftStep("liftmeta")}
        />
        <MediaPreview
          mode={mode}
          photoUri={photoUri}
          videoUri={videoUri}
          photos={photoUri ? [...extraPhotos, photoUri] : extraPhotos}
          photoCount={extraPhotos.length + 1}
          lift={liftName}
          weight={resolvedWeight}
        />
        <SectionLabel>Details</SectionLabel>
        <OptRow
          icon={<MapPin size={16} color={colors.silver} />}
          label="Gym"
          value={chosenGym ?? "Choose"}
          isSet={Boolean(gym)}
          onPress={openGymSheet}
        />
        <OptRow
          icon={<Tag size={16} color={colors.silver} />}
          label={mode === "daily" && photoUri ? "Tag people on photo" : "Tag friends"}
          value={selectedFriends.length ? selectedFriends.map((friend) => friend.name.split(" ")[0]).join(", ") : "None"}
          isSet={selectedFriends.length > 0}
          // Photo posts get Instagram-style positional tagging (M1); video keeps
          // the simple friend list.
          onPress={() =>
            mode === "daily" && photoUri
              ? setTagging(true)
              : sheet.open(<FriendsSheet initial={tags} onDone={setTags} />)
          }
        />
        <OptRow
          icon={<Music size={16} color={colors.silver} />}
          label="Music"
          value={track?.title ?? "None"}
          isSet={Boolean(track)}
          onPress={() =>
            sheet.open(
              <MusicSheet
                selected={track}
                onChange={setTrack}
                onSelect={(next) => {
                  setTrack(next);
                  sheet.close();
                }}
              />
            )
          }
        />
        <OptRow
          icon={<Users size={16} color={colors.silver} />}
          label="Post to a community"
          value={selectedCommunities.length ? selectedCommunities.map((community) => community.name).join(", ") : "None"}
          isSet={selectedCommunities.length > 0}
          onPress={() => sheet.open(
            <CommunitySheet
              chosenGymId={gym?.type === "gym" ? gym.id : null}
              initial={communities}
              onDone={setCommunities}
            />
          )}
        />
        <SectionLabel>Caption</SectionLabel>
        <TextInput
          value={caption}
          onChangeText={setCaption}
          multiline
          returnKeyType="done"
          submitBehavior="blurAndSubmit"
          placeholder={`Say something about today\u2026`}
          placeholderTextColor={colors.fog}
          textAlignVertical="top"
          style={{
            minHeight: 64,
            marginHorizontal: 18,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: colors.iron,
            backgroundColor: colors.graphite,
            paddingVertical: 12,
            paddingHorizontal: 14,
            fontSize: 14,
            color: colors.bone
          }}
        />
        <View style={{ paddingHorizontal: 18, paddingTop: 18 }}>
          {geofenceBlocked ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 12,
                paddingVertical: 11,
                paddingHorizontal: 14,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.iron,
                backgroundColor: colors.graphite
              }}
            >
              <MapPin size={15} color={colors.silver} strokeWidth={2} />
              <Text style={{ flex: 1, fontFamily: "Geist_500Medium", fontSize: 12.5, color: colors.mist }}>
                You need to be at a gym to post — or choose Custom location.
              </Text>
            </View>
          ) : null}
          <Button loading={publishing} disabled={publishing || geofenceBlocked} onPress={submitPost}>
            Post
          </Button>
          {/* Explicit draft save — the ONLY way a draft gets created besides
              the keep-as-draft prompt on close. */}
          <Pressable accessibilityLabel="Save as draft" onPress={saveAsDraft} disabled={publishing}>
            <View
              style={{
                marginTop: 10,
                height: 46,
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 12,
                borderWidth: 1,
                borderColor: colors.iron
              }}
            >
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.mist }}>Save as draft</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* Trophy unlock — shown after a lift post crosses a new tier; closing it
          continues to the feed. */}

    </KeyboardAvoidingView>
  );
}
