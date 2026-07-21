import { useQueryClient } from "@tanstack/react-query";
// Gesture-handler ScrollView: scrolls correctly inside the bottom sheet, where
// BottomSheetScrollView only works as the sheet's direct child and RN's own
// ScrollView loses the pan gesture to the sheet.
import { Gesture, GestureDetector, ScrollView as SheetScrollView } from "react-native-gesture-handler";
import { CameraView, useCameraPermissions, useMicrophonePermissions, type CameraType } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ChevronLeft,
  Dumbbell,
  Home,
  Image as ImageIcon,
  MapPin,
  Music,
  Pencil,
  Plus,
  RefreshCw,
  Tag,
  Users,
  X
} from "lucide-react-native";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import * as ImageManipulator from "expo-image-manipulator";
import { useVideoPlayer, VideoView } from "expo-video";
import {
  ActivityIndicator,
  Alert,
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
import { TrophyUnlockModal } from "@/components/trophies/TrophyUnlockModal";
import { type TrophyShareData } from "@/components/trophies/TrophyShareCard";
import { LIFT_OPTIONS, LIFT_OPTION_BY_ID, newlyUnlockedTiers, type LiftExercise } from "@/lib/liftCatalog";
import { useLogLift, useUserLifts } from "@/hooks/queries/useUserLifts";
import { PhotoEditor } from "@/components/camera/PhotoEditor";
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
import {
  formatDistance,
  useGymSearch,
  type GymSearchCoords,
  type GymSearchResult
} from "@/hooks/queries/useGymSearch";
import { Image as ExpoImage } from "expo-image";
import * as ImagePicker from "expo-image-picker";

import { useFriends } from "@/hooks/queries/useFriends";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { useSuggestedTracks, useTrackSearch, type MusicTrack } from "@/lib/music";
import { useMyCommunities, type CommunitySummary } from "@/hooks/queries/useCommunities";
import { usePostStory } from "@/hooks/queries/useStories";
import { logger } from "@/lib/logger";
import { publishDailyPost, publishLiftVideo } from "@/lib/posts";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { usePostedState } from "@/hooks/queries/usePostedState";
import { markPostedToday, showToast, triggerFlash } from "@/stores/ui";
import { colors } from "@/theme/colors";

type Mode = "daily" | "lift" | "story";
type DailyStep = "capture" | "review" | "compose";
type LiftStep = "record" | "review" | "liftmeta" | "compose";

/** Where the post happened: a real mapped gym row, or an unmapped location. */
type SelectedGym =
  | { type: "gym"; id: string; name: string }
  | { type: "home" }
  | { type: "other" };


// Module-scoped so it survives camera remounts: we only auto-prompt for
// location once per app session, never on every open.
let locationAskedThisSession = false;


function gymName(gym: SelectedGym | null): string | null {
  if (!gym) return null;
  if (gym.type === "home") return "Home gym";
  if (gym.type === "other") return "Other location";
  return gym.name;
}

function CircleButton({ label, onPress, children }: { label: string; onPress: () => void; children: ReactNode }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: "rgba(0,0,0,0.5)",
          borderWidth: 1,
          borderColor: colors.slate,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        {children}
      </View>
    </Pressable>
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

function ModePill({
  active,
  disabled,
  children,
  onPress
}: {
  active: boolean;
  disabled?: boolean;
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} pressScale={0.96}>
      <View
        style={{
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 999,
          borderWidth: active ? 1 : 0,
          borderColor: colors.slate,
          backgroundColor: active ? "rgba(0,0,0,0.5)" : "transparent",
          opacity: disabled ? 0.35 : 1
        }}
      >
        <Text
          style={{
            fontFamily: "GeistMono_400Regular",
            fontSize: 11,
            letterSpacing: 11 * 0.12,
            textTransform: "uppercase",
            color: active ? colors.white : colors.fog
          }}
        >
          {children}
        </Text>
      </View>
    </Pressable>
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
  photoCount = 1,
  lift,
  weight,
  width = "62%"
}: {
  mode: Mode;
  photoUri?: string;
  videoUri?: string;
  photoCount?: number;
  lift: string;
  weight: string;
  width?: `${number}%`;
}) {
  const isLift = mode === "lift";
  return (
    <View
      style={{
        width,
        maxWidth: 360,
        aspectRatio: 3 / 4,
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
        Mapped gyms show on the post. Home gym and unlisted spots won&apos;t claim a mapped gym.
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
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator color={colors.mist} />
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
        title="Home gym"
        sub="Not a mapped gym"
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
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator color={colors.mist} />
          </View>
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

function MusicSheet({ selected, onSelect }: { selected: SelectedTrack | null; onSelect: (track: SelectedTrack | null) => void }) {
  const { height: windowHeight } = useWindowDimensions();
  const listHeight = Math.min(260, Math.round(windowHeight * 0.28));
  const [query, setQuery] = useState("");
  const results = useTrackSearch(query);
  const suggested = useSuggestedTracks();
  const rows = results.data ?? [];
  // Chosen (auditioning) track — plays out loud, with a draggable clip-start.
  const [chosen, setChosen] = useState<SelectedTrack | null>(selected);
  const [clipStart, setClipStart] = useState(selected?.clipStart ?? 0);
  const clipStartRef = useRef(clipStart);
  clipStartRef.current = clipStart;

  const player = useAudioPlayer(chosen?.previewUrl ? { uri: chosen.previewUrl } : null);
  const status = useAudioPlayerStatus(player);
  const playerRef = useRef(player);
  playerRef.current = player;

  // All native player calls are wrapped: an unready/torn-down player throws
  // synchronously from .play()/.seekTo(), which crashed the picker (the
  // reported "selecting the segment crashes" bug).
  const safeSeekPlay = (seconds: number) => {
    const p = playerRef.current;
    if (!p) return;
    try {
      p.seekTo(Math.max(0, seconds)).catch(() => {});
      p.play();
    } catch {
      // Player not ready yet — the load effect will start it.
    }
  };

  const auditTrack = (track: MusicTrack) => {
    setChosen(track);
    setClipStart(0);
  };

  // Auto-play the audition from the clip start whenever the track loads.
  useEffect(() => {
    if (!chosen?.previewUrl || !status.isLoaded) return;
    safeSeekPlay(clipStartRef.current);
    // Replay only on track change / initial load, not every status tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chosen?.id, status.isLoaded]);

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
        {query.trim().length < 2 ? (
          // Suggested / trending gym songs for the empty picker.
          suggested.isLoading ? (
            <View style={{ paddingVertical: 24, alignItems: "center" }}>
              <ActivityIndicator color={colors.mist} />
            </View>
          ) : (
            <SheetScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              <Text style={{ paddingHorizontal: 20, paddingBottom: 4, fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 10.5 * 0.14, color: colors.fog }}>
                SUGGESTED
              </Text>
              {(suggested.data ?? []).map((track) => (
                <ChoiceRow
                  key={track.id}
                  title={track.title}
                  sub={`${track.explicit ? "🅴 " : ""}${track.artist}`}
                  selected={chosen?.id === track.id}
                  left={<TrackArt uri={track.artworkUrl} />}
                  onPress={() => auditTrack(track)}
                />
              ))}
            </SheetScrollView>
          )
        ) : results.isLoading ? (
          <View style={{ paddingVertical: 24, alignItems: "center" }}>
            <ActivityIndicator color={colors.mist} />
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
                sub={`${track.explicit ? "🅴 " : ""}${track.artist}`}
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
              <Text numberOfLines={1} style={{ marginTop: 2, fontSize: 12.5, color: colors.silver }}>
                {chosen.explicit ? "🅴 " : ""}{chosen.artist}
              </Text>
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
          onPress={() => onSelect(null)}
        >
          No music
        </Button>
        <Button
          style={{ flex: 1 }}
          disabled={!chosen}
          onPress={() => chosen && onSelect({ ...chosen, clipStart })}
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
  const params = useLocalSearchParams<{ mode?: string }>();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const queryClient = useQueryClient();
  const { postedToday } = usePostedState();
  const keyboardVisible = useKeyboardVisible();
  const userId = useAuthStore((state) => state.userId);
  const postStory = usePostStory();
  const [permission, requestPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const permissionAsked = useRef(false);
  const cameraRef = useRef<CameraView>(null);
  // Set by onCameraReady; gates recordAsync so we never record mid-reconfigure.
  const videoReadyRef = useRef(false);
  const lastTapRef = useRef(0);

  // Capture starts on Story or Daily; video is now always a hold-to-record
  // action on the shutter, so there's no separate Video mode to start in.
  const [mode, setMode] = useState<Mode>(() =>
    params.mode === "story" ? "story" : postedToday ? "story" : "daily"
  );
  const [dailyStep, setDailyStep] = useState<DailyStep>("capture");
  const [liftStep, setLiftStep] = useState<LiftStep>("record");
  const [videoUri, setVideoUri] = useState<string>();
  const videoTrimRef = useRef<VideoTrim | null>(null);
  const [editing, setEditing] = useState(false);
  const [facing, setFacing] = useState<CameraType>("back");
  const [zoom, setZoom] = useState(0);
  const zoomBaseRef = useRef(0);
  // Debounce the flip: rapid taps otherwise reconfigure the session faster than
  // it can keep up and stall the camera.
  const flipLockRef = useRef(false);
  const [recording, setRecording] = useState(false);
  /** Hands-free lock (slid onto the lock icon) — recording continues after release. */
  const [recordLocked, setRecordLocked] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  // Camera session config: "picture" captures full-sensor stills (best photo
  // quality); we only flip to "video" while actually recording (video mode
  // caps stills to video resolution, which made photos look terrible).
  const [camMode, setCamMode] = useState<"picture" | "video">("picture");
  const [photoUri, setPhotoUri] = useState<string>();
  /** Earlier shots in a multi-photo daily post (carousel). Max 4 total. */
  const [extraPhotos, setExtraPhotos] = useState<string[]>([]);
  // Workout entry — the exercise list is the strength trophy catalog, and the
  // number (weight for barbell lifts, reps for bodyweight) drives the trophy.
  const [liftExercise, setLiftExercise] = useState<LiftExercise>("bench");
  const [liftValue, setLiftValue] = useState("");
  const [celebrate, setCelebrate] = useState<TrophyShareData | null>(null);
  const userLifts = useUserLifts(userId);
  const logLift = useLogLift();
  const [gym, setGym] = useState<SelectedGym | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [track, setTrack] = useState<(MusicTrack & { clipStart?: number }) | null>(null);
  const [communities, setCommunities] = useState<string[]>([]);
  const [caption, setCaption] = useState("");
  const [coords, setCoords] = useState<GymSearchCoords | null>(null);
  const [locationSettled, setLocationSettled] = useState(false);
  const [publishing, setPublishing] = useState(false);
  // Story music — same picker as daily posts, played during story viewing.
  const [storyTrack, setStoryTrack] = useState<SelectedTrack | null>(null);
  // Friends tagged on the story — rendered as tappable chips in the viewer.
  const [storyTags, setStoryTags] = useState<string[]>([]);

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

  const switchMode = (next: Mode) => {
    if (next === "daily" && postedToday) return;
    // Video (lift) is a peer option from the moment the camera opens — no longer
    // gated behind posting the daily photo first (composer spec C3).
    setRecording(false);
    setRecordSeconds(0);
    setExtraPhotos([]);
    setMode(next);
    if (next === "daily" || next === "story") {
      setDailyStep("capture");
    } else {
      setLiftStep("record");
      setFacing("back");
      // Ask for the mic up front so the first recording has sound. Denied is
      // fine — we record muted rather than block.
      if (!micPermission?.granted && micPermission?.canAskAgain) {
        void requestMicPermission();
      }
    }
  };

  /** Flip front/back, debounced so spamming can't outrun the camera session. */
  const flipCamera = () => {
    if (flipLockRef.current || recording) return;
    flipLockRef.current = true;
    setZoom(0);
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

  /** Pinch-to-zoom over the preview. expo-camera zoom is 0–1. */
  const pinchZoom = Gesture.Pinch()
    .onBegin(() => {
      zoomBaseRef.current = zoom;
    })
    .runOnJS(true)
    .onUpdate((e) => {
      const next = zoomBaseRef.current + (e.scale - 1) * 0.35;
      setZoom(Math.max(0, Math.min(1, next)));
    });

  const shareStory = async () => {
    if (!photoUri) {
      Alert.alert("No photo", "The photo didn't save. Go back and retake it.");
      return;
    }
    setPublishing(true);
    try {
      await postStory.mutateAsync({
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
        tagUserIds: storyTags
      });
      setStoryTrack(null);
      setStoryTags([]);
      showToast("Added to your story");
      router.replace("/(tabs)/feed");
    } catch (error) {
      logger.warn("story_publish_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      Alert.alert("Couldn't post", "Something went wrong. Check your connection and try again.");
    } finally {
      setPublishing(false);
    }
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
      // Full-quality still (no skipProcessing → keep iOS image processing) in
      // picture mode = best resolution the device offers. No automatic crop —
      // the photo keeps its full frame; cropping is user-driven in the editor.
      const photo = await cameraRef.current?.takePictureAsync({ quality: 1 });
      if (photo?.uri) {
        // The OS un-mirrors front-camera captures; flip back so the saved photo
        // matches the mirrored selfie preview. Single near-lossless re-encode.
        if (facing === "front") {
          const flipped = await ImageManipulator.manipulateAsync(
            photo.uri,
            [{ flip: ImageManipulator.FlipType.Horizontal }],
            { compress: 0.98, format: ImageManipulator.SaveFormat.JPEG }
          );
          uri = flipped.uri;
        } else {
          uri = photo.uri;
        }
      }
    } catch {
      uri = undefined;
    }
    setPhotoUri(uri);
    setDailyStep("review");
  }, [facing, mode, permission?.canAskAgain, permission?.granted, requestPermission]);

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
    setRecording(true);
    // Flip the session to video mode, then record ONLY once the freshly-remounted
    // camera reports ready (onCameraReady). The old fixed-400ms guess called
    // recordAsync mid-reconfigure, which could hang and produce nothing — the
    // "video doesn't work at all" bug. recordAsync resolves when stopRecording is
    // called (or maxDuration hits); any failure lands back on capture with a toast.
    videoReadyRef.current = false;
    setCamMode("video");
    void (async () => {
      try {
        // Wait for the video session to be ready (bounded), then record.
        const start = Date.now();
        while (!videoReadyRef.current && Date.now() - start < 2500) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        // A touch of settle time after "ready" so the first frames aren't dropped.
        await new Promise((resolve) => setTimeout(resolve, 120));
        const result = await cameraRef.current?.recordAsync({ maxDuration: 60 });
        if (result?.uri) {
          videoTrimRef.current = null;
          setVideoUri(result.uri);
          setMode("lift");
          setLiftStep("review");
        } else {
          showToast("Recording didn't save — try again");
        }
      } catch (error) {
        logger.warn("record_failed", { message: error instanceof Error ? error.message : String(error) });
        showToast("Couldn't record — try again");
      } finally {
        setRecording(false);
        setRecordLocked(false);
        // Restore picture mode so the next tap captures a full-quality photo.
        setCamMode("picture");
        triggerFlash();
      }
    })();
  };

  const stopRecording = () => cameraRef.current?.stopRecording();

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
      showToast("Be at a gym to post — or pick Home gym");
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
        Alert.alert("No video", "The clip didn't save. Go back and retake it.");
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
        await queryClient.invalidateQueries({ queryKey: ["feed"] });
        await queryClient.invalidateQueries({ queryKey: ["user-lifts", userId] });
        if (unlockedData) {
          // Celebrate first; navigate to the feed when the modal closes.
          setCelebrate(unlockedData);
        } else {
          showToast("Video posted");
          router.replace("/(tabs)/feed");
        }
      } catch (error) {
        logger.warn("lift_publish_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
        Alert.alert("Couldn't post", "Something went wrong uploading your video. Check your connection and try again.");
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
    if (!photoUri) {
      Alert.alert("No photo", "The photo didn't save. Go back and retake it.");
      return;
    }
    setPublishing(true);
    try {
      // Music is stored in its own columns; the caption carries text + friend tags.
      const captionForPost = [caption.trim(), selectedFriends.map((friend) => friend.handle).join(" ")]
        .filter(Boolean)
        .join(" ");
      const postId = await publishDailyPost({
        userId,
        photoUris: [...extraPhotos, photoUri],
        caption: captionForPost,
        gymId: gym?.type === "gym" ? gym.id : null,
        locationKind: gym?.type ?? "other",
        musicTitle: track?.title ?? null,
        musicArtist: track?.artist ?? null,
        musicPreviewUrl: track?.previewUrl ?? null,
        musicArtworkUrl: track?.artworkUrl ?? null,
        musicClipStart: track?.clipStart ?? 0
      });
      // Persist tagged friends as rows (best-effort — the post itself is live).
      if (tags.length) {
        const { error: tagError } = await supabase
          .from("post_tags")
          .insert(tags.map((id) => ({ post_id: postId, user_id: id })));
        if (tagError) {
          logger.warn("post_tags_insert_failed", { message: tagError.message });
        }
      }
      // Cross-post to the chosen communities (best-effort — the post itself is live).
      const crossPosts = selectedCommunities
        .filter((community) => community.type !== "gym" || (gym?.type === "gym" && community.gym_id === gym.id))
        .map((community) => ({ post_id: postId, community_id: community.id }));
      if (crossPosts.length) {
        const { error: crossError } = await supabase.from("post_communities").insert(crossPosts);
        if (crossError) {
          logger.warn("post_communities_insert_failed", { message: crossError.message });
        }
      }
      markPostedToday();
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      showToast("Posted. Feed unlocked.");
      router.replace("/(tabs)/feed");
    } catch (error) {
      logger.warn("daily_post_publish_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      Alert.alert("Couldn't post", "Something went wrong uploading your photo. Check your connection and try again.");
    } finally {
      setPublishing(false);
    }
  };

  // Story/photo editor (never for the raw daily post). The boundary keeps any
  // editor crash from taking down the app — worst case you're back on preview.
  if (editing && photoUri && mode !== "daily") {
    return (
      <EditorBoundary onClose={() => setEditing(false)}>
        <PhotoEditor
          uri={photoUri}
          onDone={(edited) => {
            setPhotoUri(edited);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </EditorBoundary>
    );
  }

  const isCapture = mode === "lift" ? liftStep === "record" : dailyStep === "capture";

  if (isCapture) {
    const stepLabel = mode === "lift" ? "VIDEO" : mode === "story" ? "STORY" : "TODAY'S PHOTO";
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        {permission?.granted ? (
          <GestureDetector gesture={pinchZoom}>
            <View style={{ position: "absolute", inset: 0 }}>
              <CameraView
                // Remount on mode change so onCameraReady re-fires for the new
                // (video) session — that's the signal we wait on before recording.
                key={camMode}
                ref={cameraRef}
                facing={facing}
                mode={camMode}
                zoom={zoom}
                mute={!micPermission?.granted}
                videoQuality="1080p"
                animateShutter={false}
                onCameraReady={() => {
                  videoReadyRef.current = true;
                }}
                style={{ position: "absolute", inset: 0 }}
              />
              {/* Double-tap to flip — behind the controls so buttons still work. */}
              <Pressable
                onPress={handleCameraTap}
                style={{ position: "absolute", inset: 0 }}
                accessibilityLabel="Double tap to switch camera"
              >
                <View style={{ flex: 1 }} />
              </Pressable>
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
        {/* Zoom readout while zoomed in. */}
        {zoom > 0.01 ? (
          <View pointerEvents="none" style={{ position: "absolute", top: insets.top + 60, alignSelf: "center", paddingVertical: 4, paddingHorizontal: 12, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.55)" }}>
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 11, color: colors.white }}>
              {`${(1 + zoom * 4).toFixed(1)}x`}
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
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <CircleButton label="Close camera" onPress={() => router.back()}>
            <X color={colors.white} size={20} strokeWidth={2.2} />
          </CircleButton>
          <StepPill>{stepLabel}</StepPill>
          <CircleButton label="Flip camera" onPress={flipCamera}>
            <RefreshCw color={colors.white} size={19} strokeWidth={2} />
          </CircleButton>
        </View>

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
              onTap={() => void capturePhoto()}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onLock={() => setRecordLocked(true)}
            />
            {/* Spacer to keep the shutter centered. */}
            <View style={{ width: 40 }} />
          </View>
          {recording ? (
            <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, letterSpacing: 1, color: "rgba(255,255,255,0.75)" }}>
              {recordLocked ? "TAP TO STOP" : "SLIDE TO LOCK"}
            </Text>
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
                <ModePill active={mode === "story"} onPress={() => switchMode("story")}>
                  Story
                </ModePill>
                <ModePill active={mode === "daily"} disabled={postedToday} onPress={() => switchMode("daily")}>
                  {postedToday ? "Daily \u2713" : "Daily"}
                </ModePill>
              </View>
              <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 9.5, letterSpacing: 0.8, color: "rgba(255,255,255,0.55)" }}>
                TAP FOR PHOTO {"\u00b7"} HOLD FOR VIDEO
              </Text>
            </>
          )}
        </View>
      </View>
    );
  }

  if ((mode === "daily" || mode === "story") && dailyStep === "review") {
    return (
      <View style={{ flex: 1, backgroundColor: colors.black }}>
        {/* Full-bleed shot \u2014 same framing the camera had. */}
        <ScenePhoto
          uri={photoUri}
          scene="s2"
          legibility={false}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />

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
          <CircleButton label="Retake" onPress={() => setDailyStep("capture")}>
            <ChevronLeft color={colors.white} size={20} />
          </CircleButton>
          <StepPill>{mode === "story" ? "STORY" : "YOUR SHOT"}</StepPill>
          {mode === "story" ? (
            <Pressable onPress={() => setEditing(true)} accessibilityLabel="Edit story">
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7, height: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: colors.white, justifyContent: "center" }}>
                <Pencil size={16} color={colors.black} strokeWidth={2.4} />
                <Text style={{ fontFamily: "Geist_700Bold", fontSize: 15, color: colors.black }}>Edit</Text>
              </View>
            </Pressable>
          ) : extraPhotos.length + 1 < 4 ? (
            /* Multi-photo: bank this shot and go take another (carousel post). */
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
              {/* Music pill — same catalog picker as daily posts. */}
              <Pressable
                onPress={() =>
                  sheet.open(
                    <MusicSheet
                      selected={storyTrack}
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
              <Button onPress={() => void shareStory()} loading={publishing} disabled={publishing}>
                Share to story
              </Button>
            </>
          ) : (
            <Button onPress={() => setDailyStep("compose")}>Continue {"\u203a"}</Button>
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
      <View style={{ flex: 1, backgroundColor: colors.black }}>
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
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.black }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
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
          label="Tag friends"
          value={selectedFriends.length ? selectedFriends.map((friend) => friend.name.split(" ")[0]).join(", ") : "None"}
          isSet={selectedFriends.length > 0}
          onPress={() => sheet.open(<FriendsSheet initial={tags} onDone={setTags} />)}
        />
        <OptRow
          icon={<Music size={16} color={colors.silver} />}
          label="Music"
          value={track?.title ?? "None"}
          isSet={Boolean(track)}
          onPress={() => sheet.open(<MusicSheet selected={track} onSelect={(next) => { setTrack(next); sheet.close(); }} />)}
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
                You need to be at a gym to post — or choose Home gym as your location.
              </Text>
            </View>
          ) : null}
          <Button loading={publishing} disabled={publishing || geofenceBlocked} onPress={submitPost}>
            Post
          </Button>
        </View>
      </ScrollView>

      {/* Trophy unlock — shown after a lift post crosses a new tier; closing it
          continues to the feed. */}
      <TrophyUnlockModal
        data={celebrate}
        visible={celebrate !== null}
        onClose={() => {
          setCelebrate(null);
          router.replace("/(tabs)/feed");
        }}
      />
    </KeyboardAvoidingView>
  );
}
