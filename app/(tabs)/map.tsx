import * as Location from "expo-location";
import { useRouter, type Href } from "expo-router";
import {
  ChevronRight,
  Dumbbell,
  Flame,
  KeyRound,
  Pin,
  Plus,
  Users
} from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import { Alert, ActivityIndicator, Platform, ScrollView, Share, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GymPreviewSheet } from "@/components/map/GymPreviewSheet";
import { MapCanvas } from "@/components/map/MapCanvas";
import { Button } from "@/components/ui/Button";
import { CachedImage } from "@/components/ui/CachedImage";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { SheetTextInput } from "@/components/ui/SheetTextInput";
import { Segmented } from "@/components/ui/Segmented";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { SkeletonRows, SkeletonWorkoutRow } from "@/components/ui/Skeleton";
import {
  useDiscoverCommunities,
  useJoinByCode,
  useJoinCommunity,
  useJoinGymCommunity,
  useMyCommunities,
  useMyPendingJoinRequests,
  type CommunitySummary
} from "@/hooks/queries/useCommunities";
import {
  useCrewActivity,
  useHomeGymHub,
  useLiveFriendPresence,
  useMarkCommunityRead,
  useMyRecentNudges,
  useNearbyFriendGyms,
  useNudgeCommunity,
  useWave,
  type LivePresenceRow
} from "@/hooks/queries/useCommunitiesHome";
import { useFriends } from "@/hooks/queries/useFriends";
import { nearestGyms, useMapGyms, type MapGym } from "@/hooks/queries/useMapGyms";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useDeleteWorkout, useWorkouts, type WorkoutRow } from "@/hooks/queries/useWorkouts";
import { COMMUNITY_ICONS } from "@/lib/communityTypes";
import { relDay } from "@/lib/relDay";
import { fmtClock } from "@/lib/workoutLibrary";
import { logger } from "@/lib/logger";
import { showToast } from "@/stores/ui";
import { useWorkoutSession } from "@/stores/workoutSession";
import { colors } from "@/theme/colors";
import { radius, tokens } from "@/theme/tokens";

const NAV_H = 84;
const DISP = "Geist_700Bold";
const NUM = "GeistMono_500Medium";
const CARDIO = "#FF8A4C";
const CARDIO_TINT = "rgba(255,138,76,0.14)";

/** Tiny letterspaced caps label. */
function Micro({ children, style }: { children: React.ReactNode; style?: object }) {
  return (
    <Text
      style={[
        { fontFamily: "Geist_600SemiBold", fontSize: 10, letterSpacing: 1.6, textTransform: "uppercase", color: tokens.text.tertiary },
        style
      ]}
    >
      {children}
    </Text>
  );
}

/** Pulsing live dot (spec `.dot` / prototype `blink`). */
function PulseDot({ color = colors.white, size = 8 }: { color?: string; size?: number }) {
  const reduced = useReducedMotion();
  const o = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    o.value = withRepeat(withTiming(0.25, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [reduced, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function ClusterSheet({ gyms, onGym }: { gyms: MapGym[]; onGym: (gym: MapGym) => void }) {
  const shown = gyms.slice(0, 12);
  return (
    <View>
      <SheetTitle>{`${gyms.length} gyms here`}</SheetTitle>
      <SheetSub>Zoom in on the map, or pick one below.</SheetSub>
      {shown.map((gym) => (
        <Pressable key={gym.id} onPress={() => onGym(gym)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 20 }}>
            <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
              <Dumbbell size={14} color={colors.mist} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: colors.bone }} numberOfLines={1}>
                {gym.name}
              </Text>
              {gym.address ? (
                <Text style={{ marginTop: 1, fontSize: 11.5, color: colors.fog }} numberOfLines={1}>
                  {gym.address}
                </Text>
              ) : null}
            </View>
          </View>
        </Pressable>
      ))}
      {gyms.length > shown.length ? (
        <Text style={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: 4, fontSize: 11.5, color: colors.fog }}>
          {`+ ${gyms.length - shown.length} more — zoom in to see them all`}
        </Text>
      ) : null}
    </View>
  );
}

/** Sheet: join any community (incl. private) by entering its invite code. */
function InviteCodeSheet() {
  const sheet = useSheet();
  const router = useRouter();
  const joinByCode = useJoinByCode();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = code.trim();
    if (trimmed.length < 4) {
      setError("Enter the full code.");
      return;
    }
    setError(null);
    joinByCode.mutate(trimmed, {
      onSuccess: (communityId) => {
        if (communityId) {
          sheet.close();
          showToast("You're in");
          router.push(`/community/${communityId}` as Href);
        } else {
          setError("That code isn't valid — check it and try again.");
        }
      },
      onError: () => setError("Couldn't join right now — try again.")
    });
  };

  return (
    <View>
      <SheetTitle>Enter invite code</SheetTitle>
      <SheetSub>Join a private community directly with its code.</SheetSub>
      <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
        <SheetTextInput
          value={code}
          onChangeText={(v) => {
            setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8));
            setError(null);
          }}
          autoFocus
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="ABC1234"
          placeholderTextColor={colors.fog}
          onSubmitEditing={submit}
          style={{
            height: 52,
            borderWidth: 1,
            borderColor: error ? "#EF4444" : colors.iron,
            borderRadius: 12,
            backgroundColor: colors.graphite,
            paddingHorizontal: 16,
            fontFamily: "GeistMono_500Medium",
            fontSize: 18,
            letterSpacing: 4,
            color: colors.white,
            textAlign: "center"
          }}
        />
        {error ? (
          <Text style={{ paddingTop: 8, fontSize: 12.5, color: "#EF4444", textAlign: "center" }}>{error}</Text>
        ) : null}
        <View style={{ paddingTop: 14 }}>
          <Button loading={joinByCode.isPending} disabled={joinByCode.isPending} onPress={submit}>
            Join
          </Button>
        </View>
      </View>
    </View>
  );
}

/** IN PROGRESS resume card (prototype) — live timer + session shape. */
function InProgressCard({ onResume }: { onResume: () => void }) {
  const session = useWorkoutSession();
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = session.startedAt ? Math.max(0, Math.floor((nowMs - session.startedAt) / 1000)) : 0;

  let vol = 0;
  let sets = 0;
  for (const ex of session.exercises) {
    for (const s of ex.sets) {
      sets += 1;
      if (ex.kind === "lift") vol += (s as { w: number; r: number }).w * (s as { w: number; r: number }).r;
    }
  }
  const exCount = session.exercises.length;
  const hasLift = session.exercises.some((e) => e.kind === "lift");
  const hasCardio = session.exercises.some((e) => e.kind === "cardio");
  const title =
    exCount === 0
      ? "New workout"
      : hasLift && hasCardio
        ? "Mixed workout"
        : hasCardio
          ? "Cardio session"
          : "Lifting session";
  const meta =
    exCount === 0
      ? "Tap to add your first exercise"
      : `${vol > 0 ? `${vol.toLocaleString()} lb · ` : ""}${sets} ${sets === 1 ? "set" : "sets"} · ${exCount} ${exCount === 1 ? "exercise" : "exercises"}`;

  return (
    <Pressable onPress={onResume} style={{ marginHorizontal: 18, marginBottom: 12 }}>
      <View
        style={{
          borderWidth: 1,
          borderColor: "rgba(232,180,76,0.4)",
          backgroundColor: tokens.accent.goldSubtle,
          borderRadius: radius.lg,
          padding: 18
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <PulseDot color={tokens.accent.gold} size={9} />
            <Text style={{ fontFamily: DISP, fontSize: 12, letterSpacing: 1.5, color: tokens.accent.gold }}>
              IN PROGRESS · <Text style={{ fontFamily: NUM }}>{fmtClock(elapsed)}</Text>
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontFamily: DISP, fontSize: 14, color: tokens.accent.gold }}>Resume</Text>
            <ChevronRight size={17} color={tokens.accent.gold} strokeWidth={2.2} />
          </View>
        </View>
        <Text style={{ marginTop: 12, fontFamily: DISP, fontSize: 20, color: tokens.text.primary }}>{title}</Text>
        <Text style={{ marginTop: 3, fontFamily: NUM, fontSize: 13.5, color: tokens.text.secondary }}>{meta}</Text>
      </View>
    </Pressable>
  );
}

export default function MapTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
  const profile = useMyProfile();
  const homeGym = profile.data?.gym ?? null;
  const communities = useMyCommunities();
  const mapGyms = useMapGyms();
  const myId = profile.data?.id ?? null;
  const workouts = useWorkouts(myId);
  const sessionActive = useWorkoutSession((s) => s.active);
  // My Workouts is the default, far-left tab (the Dumbbell tab opens here).
  const [tab, setTab] = useState("My Workouts");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSettled, setLocationSettled] = useState(false);
  // Discover: public communities to join, searchable by name.
  const [discoverQuery, setDiscoverQuery] = useState("");
  const discover = useDiscoverCommunities(discoverQuery, homeGym?.id ?? null);
  const joinPublic = useJoinCommunity();
  const joinGymCommunity = useJoinGymCommunity();

  // Communities-tab data (spec).
  const friends = useFriends();
  const presence = useLiveFriendPresence();
  const hub = useHomeGymHub(homeGym?.id ?? null);
  const myCommunities = useMemo(() => communities.data ?? [], [communities.data]);
  const crewIds = useMemo(
    () => myCommunities.filter((c) => c.id !== hub.data?.communityId).map((c) => c.id),
    [myCommunities, hub.data?.communityId]
  );
  const crewActivity = useCrewActivity(crewIds);
  const recentNudges = useMyRecentNudges();
  const pendingRequests = useMyPendingJoinRequests();
  const nudge = useNudgeCommunity();
  const deleteWorkout = useDeleteWorkout();
  const wave = useWave();
  const markRead = useMarkCommunityRead();
  const friendGymIds = useMemo(() => (friends.data ?? []).map((f) => f.home_gym_id), [friends.data]);
  const nearbyGyms = useNearbyFriendGyms(friendGymIds, homeGym?.id ?? null, coords);

  const [liveOpen, setLiveOpen] = useState(false);
  const [waved, setWaved] = useState<Set<string>>(new Set());
  const [joinedGyms, setJoinedGyms] = useState<Set<string>>(new Set());
  const [nudgedNow, setNudgedNow] = useState<Record<string, number>>({});

  // Resolve location BEFORE the native map mounts: MapCanvas renders with a
  // final region and a frozen marker set (see its stability contract).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await Location.getForegroundPermissionsAsync();
        if (!status.granted) return;
        const position =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!cancelled && position) {
          setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        }
      } catch (error) {
        logger.warn("map_location_failed", {
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

  // Cap to the nearest gyms once — MapCanvas freezes its marker set at mount,
  // and re-sorting the full dataset on every parent re-render is wasted work.
  const mapGymData = mapGyms.data;
  const gymsForMap = useMemo(() => nearestGyms(mapGymData ?? [], coords), [mapGymData, coords]);

  const openGym = (gym: MapGym) => {
    sheet.open(<GymPreviewSheet gym={gym} close={sheet.close} />);
  };

  const openCluster = (clusterGyms: MapGym[]) => {
    sheet.open(<ClusterSheet gyms={clusterGyms} onGym={openGym} />);
  };

  const openHomeGymCommunity = () => {
    if (!homeGym) return;
    if (hub.data?.communityId) {
      router.push(`/community/${hub.data.communityId}` as Href);
      return;
    }
    // No community yet — create/join it, then open.
    joinGymCommunity.mutate(homeGym.id, {
      onSuccess: (communityId) => router.push(`/community/${communityId}` as Href),
      onError: () => showToast("Couldn't open your gym right now")
    });
  };

  const sendWave = (row: LivePresenceRow) => {
    if (waved.has(row.userId)) return;
    setWaved((prev) => new Set(prev).add(row.userId));
    wave.mutate(
      { targetId: row.userId, gymName: row.gymName },
      { onError: () => showToast("Couldn't wave — try again") }
    );
  };

  const sendNudge = (community: CommunitySummary) => {
    nudge.mutate(community.id, {
      onSuccess: (count) => {
        setNudgedNow((prev) => ({ ...prev, [community.id]: count }));
        showToast(count > 0 ? `Nudge sent to ${count} ${count === 1 ? "member" : "members"}` : "Nudge sent");
      },
      onError: () => showToast("Already nudged in the last 24h")
    });
  };

  const joinNearbyGym = (gymId: string, name: string) => {
    if (joinedGyms.has(gymId)) return;
    joinGymCommunity.mutate(gymId, {
      onSuccess: () => {
        setJoinedGyms((prev) => new Set(prev).add(gymId));
        showToast(`Joined ${name}`);
      },
      onError: () => showToast("Couldn't join — try again")
    });
  };

  const inviteFriends = async () => {
    if (!homeGym) return;
    try {
      await Share.share({
        message: `Join me at ${homeGym.name} on SPOTTED — we hold each other to showing up. Get the app and add me.`
      });
    } catch {
      // user dismissed the sheet
    }
  };

  /* --------------------------- quiet-state copy --------------------------- */

  const quietCopy = (daysQuiet: number): string => {
    if (daysQuiet >= 21) return "This crew's gone cold. Nudge or archive it.";
    if (daysQuiet >= 7) return "A week of silence. Send them a nudge?";
    if (daysQuiet >= 3) return `Nobody's posted in ${daysQuiet} days.`;
    return "It's quiet in here. Be the one who starts it.";
  };

  /* -------------------------------- render -------------------------------- */

  const presenceRows = presence.data ?? [];
  const liveGyms = [...new Set(presenceRows.map((p) => p.gymName))];
  const liveLabel =
    presenceRows.length === 0
      ? ""
      : liveGyms.length === 1
        ? `${presenceRows.length} ${presenceRows.length === 1 ? "friend" : "friends"} at ${liveGyms[0]} now`
        : `${presenceRows.length} friends at the gym now`;

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 18, paddingBottom: 4 }}>
        <Text accessibilityRole="header" style={{ fontFamily: DISP, fontSize: 22, letterSpacing: 22 * -0.02, color: colors.white }}>
          {tab}
        </Text>
      </View>
      <Segmented options={["My Workouts", "Communities", "Map"]} value={tab} onChange={setTab} />
      {tab === "My Workouts" ? (
        <ScrollView contentContainerStyle={{ paddingBottom: NAV_H + insets.bottom + 12 }}>
          <View style={{ paddingHorizontal: 18, paddingTop: 4, paddingBottom: 6 }}>
            <Button icon={<Plus size={16} color={colors.black} />} onPress={() => router.push("/workout" as Href)}>
              Start a workout
            </Button>
          </View>
          <View style={{ paddingHorizontal: 26, paddingTop: 22, paddingBottom: 10 }}>
            <Micro style={{ letterSpacing: 3 }}>Recent</Micro>
          </View>
          {sessionActive ? <InProgressCard onResume={() => router.push("/workout" as Href)} /> : null}
          {workouts.isLoading ? (
            <View style={{ paddingVertical: 10 }}>
              <SkeletonWorkoutRow />
              <SkeletonWorkoutRow />
              <SkeletonWorkoutRow />
            </View>
          ) : (workouts.data ?? []).length === 0 && !sessionActive ? (
            <View style={{ alignItems: "center", paddingHorizontal: 40, paddingTop: 40 }}>
              <View style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 2, borderColor: tokens.accent.gold, alignItems: "center", justifyContent: "center" }}>
                <Dumbbell size={38} color={tokens.accent.gold} strokeWidth={1.7} />
              </View>
              <Text style={{ marginTop: 22, fontFamily: DISP, fontSize: 22, color: colors.white, textAlign: "center" }}>
                No workouts logged yet
              </Text>
              <Text style={{ marginTop: 10, fontSize: 14.5, lineHeight: 21, color: colors.fog, textAlign: "center", maxWidth: 280 }}>
                Start a workout to log your lifts and cardio. PRs earn trophies.
              </Text>
            </View>
          ) : (
            (workouts.data ?? []).map((w) => <WorkoutHistoryCard key={w.id} workout={w} />)
          )}
        </ScrollView>
      ) : tab === "Communities" ? (
        <ScrollView
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: NAV_H + insets.bottom + 12 }}
        >
          {/* LIVE PRESENCE — only when friends are actually there (spec). */}
          {presenceRows.length > 0 ? (
            <View style={{ paddingHorizontal: 18, paddingTop: 4 }}>
              <Pressable onPress={() => setLiveOpen((v) => !v)} accessibilityState={{ expanded: liveOpen }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    borderWidth: 1,
                    borderColor: colors.iron,
                    borderRadius: radius.sm,
                    paddingVertical: 10,
                    paddingHorizontal: 12
                  }}
                >
                  <PulseDot />
                  <View style={{ flexDirection: "row" }}>
                    {presenceRows.slice(0, 3).map((p, i) => (
                      <View
                        key={p.userId}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          marginLeft: i === 0 ? 0 : -7,
                          borderWidth: 1.5,
                          borderColor: colors.black,
                          backgroundColor: colors.slate,
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden"
                        }}
                      >
                        {p.avatarUrl ? (
                          <CachedImage source={{ uri: p.avatarUrl }} contentFit="cover" style={{ width: 24, height: 24 }} />
                        ) : (
                          <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 9, color: colors.bone }}>
                            {initialsOf(p.displayName)}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                  <Text style={{ flex: 1, fontSize: 12.5, color: colors.mist }}>
                    <Text style={{ fontFamily: "Geist_600SemiBold", color: colors.white }}>{liveLabel}</Text>
                    {" · see who"}
                  </Text>
                  <ChevronRight
                    size={15}
                    color={colors.fog}
                    style={{ transform: [{ rotate: liveOpen ? "90deg" : "0deg" }] }}
                  />
                </View>
              </Pressable>
              {liveOpen ? (
                <View style={{ marginTop: 8, borderWidth: 1, borderColor: colors.iron, borderRadius: radius.sm, overflow: "hidden" }}>
                  {presenceRows.map((p, i) => (
                    <View
                      key={p.userId}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        paddingVertical: 9,
                        paddingHorizontal: 12,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: colors.graphite
                      }}
                    >
                      <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: colors.slate, alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                        {p.avatarUrl ? (
                          <CachedImage source={{ uri: p.avatarUrl }} contentFit="cover" style={{ width: 26, height: 26 }} />
                        ) : (
                          <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 10, color: colors.bone }}>
                            {initialsOf(p.displayName)}
                          </Text>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.bone }}>
                          {p.displayName}
                        </Text>
                        <Text style={{ fontSize: 10.5, color: colors.fog }}>
                          {p.gymName} · {p.minutes < 2 ? "just checked in" : `here ${p.minutes} min`}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityLabel={`Wave at ${p.displayName}`}
                        onPress={() => sendWave(p)}
                        disabled={waved.has(p.userId)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 5,
                          borderRadius: radius.pill,
                          borderWidth: 1,
                          borderColor: waved.has(p.userId) ? colors.iron : colors.slate
                        }}
                      >
                        <Text style={{ fontSize: 10.5, fontFamily: "Geist_600SemiBold", color: waved.has(p.userId) ? colors.fog : colors.white }}>
                          {waved.has(p.userId) ? "Waved" : "Wave"}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {/* PINNED HOME GYM */}
          {homeGym ? (
            <View style={{ paddingTop: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 20, paddingBottom: 8 }}>
                <Pin size={10} color={tokens.text.tertiary} strokeWidth={2.2} />
                <Micro>Pinned · Your gym</Micro>
              </View>
              <Pressable onPress={openHomeGymCommunity} style={{ marginHorizontal: 18 }}>
                <View style={{ borderWidth: 1, borderColor: colors.slate, backgroundColor: colors.graphite, borderRadius: radius.sm, padding: 13 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ width: 42, height: 42, borderRadius: 10, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
                      <Dumbbell size={19} color={colors.mist} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 14.5, color: colors.white }}>
                        {homeGym.name}
                      </Text>
                      <Text style={{ marginTop: 2, fontSize: 11, color: colors.fog }}>
                        {hub.data
                          ? [
                              hub.data.memberCount > 0
                                ? `${hub.data.memberCount} ${hub.data.memberCount === 1 ? "member" : "members"}`
                                : "Be one of the first here",
                              hub.data.checkedInToday > 0 ? `${hub.data.checkedInToday} checked in today` : null
                            ]
                              .filter(Boolean)
                              .join(" · ")
                          : "Your home gym"}
                      </Text>
                    </View>
                    {hub.data && hub.data.checkedInToday > 0 ? (
                      <View style={{ backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ fontFamily: DISP, fontSize: 9.5, color: colors.black }}>
                          {hub.data.checkedInToday} today
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {/* Last activity — omit entirely when unknown (spec: no fake activity). */}
                  {hub.data?.lastActivity ? (
                    <View style={{ marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.iron, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 11, color: colors.fog }}>
                        <Text style={{ fontFamily: "Geist_600SemiBold", color: colors.bone }}>
                          {hub.data.lastActivity.senderName.split(" ")[0]}
                        </Text>
                        {`: ${hub.data.lastActivity.preview.slice(0, 60)} · ${relDay(hub.data.lastActivity.sentAt)}`}
                      </Text>
                      <ChevronRight size={14} color={colors.fog} />
                    </View>
                  ) : null}
                </View>
              </Pressable>
            </View>
          ) : (
            <Text style={{ paddingHorizontal: 18, paddingTop: 14, fontSize: 12.5, color: colors.fog }}>
              No home gym set yet. Pick one in onboarding or when you post.
            </Text>
          )}

          {/* YOUR CREWS — "+ New" lives in the header now; the old dashed
              create-card was one more box in an already crowded stack. */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }}>
            <Micro>Your crews</Micro>
            <Pressable
              accessibilityLabel="Start a crew"
              onPress={() => router.push("/community-new" as Href)}
              hitSlop={8}
              style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Plus size={12} color={colors.silver} strokeWidth={2.4} />
              <Text style={{ fontSize: 11, fontFamily: "Geist_600SemiBold", color: colors.silver }}>New</Text>
            </Pressable>
          </View>
          {communities.isLoading ? (
            <SkeletonRows count={3} avatar={34} />
          ) : myCommunities.filter((c) => c.id !== hub.data?.communityId).length === 0 ? (
            <Text style={{ paddingHorizontal: 20, paddingBottom: 4, fontSize: 12, color: colors.fog }}>
              No crews yet — tap New to start one with your gym friends.
            </Text>
          ) : (
            myCommunities
              .filter((c) => c.id !== hub.data?.communityId)
              .map((community) => {
                const activity = crewActivity.data?.[community.id];
                const nudgedRecently = recentNudges.data?.has(community.id) || community.id in nudgedNow;
                const daysQuiet = activity?.daysQuiet ?? Number.POSITIVE_INFINITY;
                const quiet = !activity?.last || daysQuiet >= 3;
                const showNudge = quiet && community.memberCount > 1;
                const Icon = COMMUNITY_ICONS[community.type];
                const sub =
                  community.id in nudgedNow
                    ? `Nudge sent to ${nudgedNow[community.id]} ${nudgedNow[community.id] === 1 ? "member" : "members"}.`
                    : activity?.last && !quiet
                      ? `${activity.last.senderName.split(" ")[0]}: ${activity.last.preview.slice(0, 60)}`
                      : activity?.last
                        ? quietCopy(daysQuiet)
                        : "It's quiet in here. Be the one who starts it.";
                return (
                  <Pressable
                    key={community.id}
                    onPress={() => {
                      markRead.mutate(community.id);
                      router.push(`/community/${community.id}` as Href);
                    }}
                    style={{ marginHorizontal: 18, marginBottom: 8 }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        borderWidth: 1,
                        borderColor: colors.iron,
                        borderRadius: radius.sm,
                        paddingVertical: 10,
                        paddingHorizontal: 11
                      }}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.slate, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
                        {community.photoUrl ? (
                          <CachedImage source={{ uri: community.photoUrl }} contentFit="cover" style={{ width: 34, height: 34 }} />
                        ) : (
                          <Icon size={15} color={colors.mist} />
                        )}
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: quiet && !activity?.last ? colors.bone : colors.white }}>
                          {community.name}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{ marginTop: 1, fontSize: 11, color: quiet ? "#6A6A6A" : colors.fog, fontStyle: quiet ? "italic" : "normal" }}
                        >
                          {sub}
                        </Text>
                      </View>
                      {showNudge ? (
                        <Pressable
                          accessibilityLabel={`Nudge ${community.name}`}
                          onPress={() => sendNudge(community)}
                          disabled={nudgedRecently || nudge.isPending}
                          style={{
                            paddingHorizontal: 12,
                            paddingVertical: 5,
                            borderRadius: radius.pill,
                            borderWidth: 1,
                            borderColor: nudgedRecently ? colors.iron : colors.slate
                          }}
                        >
                          <Text style={{ fontSize: 10.5, fontFamily: "Geist_600SemiBold", color: nudgedRecently ? colors.fog : colors.white }}>
                            {nudgedRecently ? "Nudged" : "Nudge"}
                          </Text>
                        </Pressable>
                      ) : activity?.unread ? (
                        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: colors.white }} />
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
          )}

          {/* REQUESTED — private communities you asked to join, awaiting approval. */}
          {(pendingRequests.data ?? []).map((request) => (
            <Pressable
              key={request.communityId}
              onPress={() => router.push(`/community/${request.communityId}` as Href)}
              style={{ marginHorizontal: 18, marginBottom: 8 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  borderWidth: 1,
                  borderColor: colors.iron,
                  borderRadius: radius.sm,
                  paddingVertical: 10,
                  paddingHorizontal: 11,
                  opacity: 0.85
                }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
                  <Users size={15} color={colors.mist} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.bone }}>
                    {request.name}
                  </Text>
                  <Text style={{ marginTop: 1, fontSize: 11, color: colors.fog }}>
                    Waiting on approval · asked {relDay(request.requestedAt)}
                  </Text>
                </View>
                <View style={{ paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.iron }}>
                  <Text style={{ fontSize: 10.5, fontFamily: "Geist_600SemiBold", color: colors.fog }}>Requested</Text>
                </View>
              </View>
            </Pressable>
          ))}

          {/* DISCOVER · NEAR YOU — hidden entirely when no gym has a friend (spec). */}
          {(nearbyGyms.data ?? []).length > 0 ? (
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
                <Micro>Discover · Near you</Micro>
                <Pressable onPress={() => setTab("Map")} style={{ marginLeft: "auto" }} hitSlop={8}>
                  <Text style={{ fontSize: 10.5, color: colors.fog }}>See all</Text>
                </Pressable>
              </View>
              {(nearbyGyms.data ?? []).map((gym) => {
                const joined = joinedGyms.has(gym.gymId);
                return (
                  <View key={gym.gymId} style={{ marginHorizontal: 18, marginBottom: 8 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        borderWidth: 1,
                        borderColor: colors.iron,
                        borderRadius: radius.sm,
                        paddingVertical: 10,
                        paddingHorizontal: 11
                      }}
                    >
                      <View style={{ width: 34, height: 34, borderRadius: 9, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
                        <Dumbbell size={15} color={colors.mist} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.white }}>
                          {gym.name}
                        </Text>
                        <Text style={{ marginTop: 1, fontSize: 11, color: colors.fog }}>
                          {`${gym.friendCount} ${gym.friendCount === 1 ? "friend trains" : "friends train"} here`}
                          {gym.distanceMi != null ? ` · ${gym.distanceMi.toFixed(1)} mi` : ""}
                        </Text>
                      </View>
                      <Pressable
                        accessibilityLabel={`Join ${gym.name}`}
                        onPress={() => joinNearbyGym(gym.gymId, gym.name)}
                        disabled={joined}
                        style={{
                          paddingHorizontal: 13,
                          paddingVertical: 5,
                          borderRadius: radius.pill,
                          borderWidth: 1,
                          borderColor: joined ? colors.iron : colors.slate
                        }}
                      >
                        <Text style={{ fontSize: 10.5, fontFamily: "Geist_600SemiBold", color: joined ? colors.fog : colors.white }}>
                          {joined ? "Joined" : "Join"}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* INVITE — while the home gym is still nearly empty (spec). */}
          {homeGym && hub.data && hub.data.memberCount < 5 ? (
            <View style={{ marginHorizontal: 18, marginTop: 10 }}>
              <View style={{ borderWidth: 1, borderStyle: "dashed", borderColor: colors.slate, borderRadius: radius.sm, padding: 13, alignItems: "center" }}>
                <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.white, textAlign: "center" }}>
                  {`You're 1 of the first ${Math.max(hub.data.memberCount, 1)} at ${homeGym.name}`}
                </Text>
                <Text style={{ marginTop: 3, marginBottom: 9, fontSize: 11, color: colors.fog }}>
                  Bring your crew. It&apos;s better full.
                </Text>
                <Pressable onPress={() => void inviteFriends()} style={{ alignSelf: "stretch" }}>
                  <View style={{ backgroundColor: colors.white, borderRadius: radius.pill, paddingVertical: 8, alignItems: "center" }}>
                    <Text style={{ fontFamily: DISP, fontSize: 11.5, color: colors.black }}>Invite friends</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          ) : null}

          {/* MORE — public discovery; the invite-code entry is a small header
              link instead of a full-width button. */}
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 }}>
            <Micro>More communities</Micro>
            <Pressable
              accessibilityLabel="Enter invite code"
              onPress={() => sheet.open(<InviteCodeSheet />)}
              hitSlop={8}
              style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5 }}
            >
              <KeyRound size={12} color={colors.silver} strokeWidth={2.2} />
              <Text style={{ fontSize: 11, fontFamily: "Geist_600SemiBold", color: colors.silver }}>Have a code?</Text>
            </Pressable>
          </View>
          <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
            <SearchBar value={discoverQuery} onChangeText={setDiscoverQuery} placeholder="Search public communities" />
          </View>
          {discover.isLoading ? (
            <SkeletonRows count={3} avatar={34} />
          ) : (discover.data ?? []).length === 0 ? (
            <Text style={{ paddingHorizontal: 18, paddingBottom: 12, fontSize: 12.5, color: colors.fog }}>
              {discoverQuery.trim() ? "No public communities match that name." : "Nothing else to discover yet."}
            </Text>
          ) : (
            (discover.data ?? []).slice(0, 10).map((community) => (
              <DiscoverCard key={community.id} community={community} />
            ))
          )}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, paddingBottom: NAV_H + insets.bottom }}>
          {!locationSettled || mapGyms.isLoading ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : (
            <MapCanvas gyms={gymsForMap} coords={coords} onGym={openGym} onCluster={openCluster} />
          )}
        </View>
      )}
    </View>
  );

  function WorkoutHistoryCard({ workout }: { workout: WorkoutRow }) {
    const cardioOnly = workout.totalVolume === 0 && workout.cardioMinutes > 0;
    const timeLabel = new Date(workout.startedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const prCount = workout.prs.length;
    // Long-press: edit or delete straight from the tab. Neither touches the
    // daily post — attached workouts are forked/hidden, never removed from it.
    const editWorkout = () => router.push(`/workout?edit=${workout.id}` as Href);
    const confirmDelete = () =>
      Alert.alert(
        "Delete workout?",
        workout.postId
          ? "It leaves your workout history — your daily post keeps it. Trophies stay."
          : "It disappears from your history. Trophies stay.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () =>
              deleteWorkout.mutate(workout.id, {
                onSuccess: () => showToast("Workout deleted"),
                onError: () => showToast("Couldn't delete — try again")
              })
          }
        ]
      );
    const openActions = () => {
      Alert.alert(workout.name, undefined, [
        { text: "Edit workout", onPress: editWorkout },
        { text: "Delete from history", style: "destructive", onPress: confirmDelete },
        { text: "Cancel", style: "cancel" }
      ]);
    };
    return (
      <Pressable
        onPress={() => router.push(`/workout/${workout.id}` as Href)}
        onLongPress={openActions}
        accessibilityActions={[
          { name: "edit", label: "Edit workout" },
          { name: "delete", label: "Delete from history" }
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "edit") editWorkout();
          else if (event.nativeEvent.actionName === "delete") confirmDelete();
        }}
        style={{ marginHorizontal: 18, marginBottom: 12 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 13,
            borderWidth: 1,
            borderColor: colors.iron,
            backgroundColor: tokens.bg.raised,
            borderRadius: radius.lg,
            padding: 16
          }}
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 13,
              backgroundColor: cardioOnly ? CARDIO_TINT : tokens.accent.goldSubtle,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            {cardioOnly ? (
              <Flame size={20} color={CARDIO} strokeWidth={1.7} />
            ) : (
              <Dumbbell size={21} color={tokens.accent.gold} strokeWidth={1.8} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text numberOfLines={1} style={{ fontFamily: DISP, fontSize: 16, color: colors.white }}>
                {workout.name}
              </Text>
              {prCount > 0 ? (
                <View style={{ backgroundColor: tokens.accent.gold, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontFamily: DISP, fontSize: 10, letterSpacing: 1, color: colors.black }}>
                    {prCount} {prCount === 1 ? "PR" : "PRs"}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={{ marginTop: 2, fontFamily: NUM, fontSize: 12, color: colors.fog }}>
              {`${relDay(workout.startedAt)} · ${timeLabel} · ${workout.exerciseCount} ${workout.exerciseCount === 1 ? "exercise" : "exercises"}`}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 8 }}>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontFamily: NUM, fontSize: 17, color: colors.white }}>
                {workout.totalSets > 0 ? `${workout.totalSets}` : `${workout.exerciseCount}`}
              </Text>
              <Micro style={{ marginTop: 1, letterSpacing: 0.5 }}>
                {workout.totalSets > 0 ? (workout.totalSets === 1 ? "set" : "sets") : "activities"}
              </Micro>
            </View>
            <ChevronRight size={17} color={colors.slate} />
          </View>
        </View>
      </Pressable>
    );
  }

  function DiscoverCard({ community }: { community: CommunitySummary }) {
    const Icon = COMMUNITY_ICONS[community.type];
    return (
      <Pressable
        onPress={() => router.push(`/community/${community.id}` as Href)}
        style={{ marginHorizontal: 18, marginBottom: 8 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            borderWidth: 1,
            borderColor: colors.iron,
            borderRadius: radius.sm,
            paddingVertical: 10,
            paddingHorizontal: 11
          }}
        >
          <View style={{ width: 34, height: 34, borderRadius: 9, overflow: "hidden", borderWidth: 1, borderColor: colors.slate, backgroundColor: colors.charcoal, alignItems: "center", justifyContent: "center" }}>
            {community.photoUrl ? (
              <CachedImage source={{ uri: community.photoUrl }} contentFit="cover" style={{ width: 34, height: 34 }} />
            ) : (
              <Icon size={15} color={colors.mist} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13, color: colors.white }} numberOfLines={1}>
              {community.name}
            </Text>
            <View style={{ marginTop: 2, flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Users size={10} color={colors.fog} strokeWidth={2} />
              <Text style={{ fontSize: 11, color: colors.fog }}>{`${community.memberCount}`}</Text>
              {community.location ? (
                <Text style={{ fontSize: 11, color: colors.fog }} numberOfLines={1}>
                  {` · ${community.location}`}
                </Text>
              ) : null}
            </View>
          </View>
          <Pressable
            accessibilityLabel={`Join ${community.name}`}
            onPress={() =>
              joinPublic.mutate(community.id, {
                onSuccess: () => showToast(`Joined ${community.name}`),
                onError: () => showToast("Couldn't join — try again")
              })
            }
            style={{ paddingHorizontal: 13, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.slate }}
          >
            <Text style={{ fontSize: 10.5, fontFamily: "Geist_600SemiBold", color: colors.white }}>Join</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  }
}
