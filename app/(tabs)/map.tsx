import { Image } from "expo-image";
import * as Location from "expo-location";
import { useRouter, type Href } from "expo-router";
import { Dumbbell, Grid3x3, KeyRound, MapPin, MessageCircle, Plus, Users } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GymPreviewSheet } from "@/components/map/GymPreviewSheet";
import { MapCanvas } from "@/components/map/MapCanvas";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { SearchBar } from "@/components/ui/SearchBar";
import { Segmented } from "@/components/ui/Segmented";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { TypePill } from "@/components/ui/Chips";
import {
  useDiscoverCommunities,
  useJoinByCode,
  useJoinCommunity,
  useMyCommunities,
  type CommunitySummary
} from "@/hooks/queries/useCommunities";
import { useMapGyms, type MapGym } from "@/hooks/queries/useMapGyms";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useWorkouts, type WorkoutRow } from "@/hooks/queries/useWorkouts";
import { COMMUNITY_ICONS } from "@/lib/communityTypes";
import { fmtClock } from "@/lib/workoutLibrary";
import { logger } from "@/lib/logger";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

const NAV_H = 84;

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

/** Sheet: join any community (incl. private) by entering its invite code (19). */
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
        <TextInput
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
  // My Workouts is the default, far-left tab (the Dumbbell tab opens here).
  const [tab, setTab] = useState("My Workouts");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSettled, setLocationSettled] = useState(false);
  // Discover (20): public communities to join, searchable by name.
  const [discoverQuery, setDiscoverQuery] = useState("");
  const discover = useDiscoverCommunities(discoverQuery, homeGym?.id ?? null);
  const joinPublic = useJoinCommunity();

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

  const openGym = (gym: MapGym) => {
    sheet.open(<GymPreviewSheet gym={gym} close={sheet.close} />);
  };

  const openCluster = (clusterGyms: MapGym[]) => {
    sheet.open(<ClusterSheet gyms={clusterGyms} onGym={openGym} />);
  };

  const openHomeGym = () => {
    if (!homeGym) return;
    const full = (mapGyms.data ?? []).find((gym) => gym.id === homeGym.id);
    if (full) {
      openGym(full);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 18, paddingBottom: 4 }}>
        <Text style={{ fontFamily: "Geist_700Bold", fontSize: 22, letterSpacing: 22 * -0.02, color: colors.white }}>
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
          <SectionLabel>Recent</SectionLabel>
          {workouts.isLoading ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator color={colors.mist} />
            </View>
          ) : (workouts.data ?? []).length === 0 ? (
            <View style={{ alignItems: "center", paddingHorizontal: 30, paddingTop: 26 }}>
              <View style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 1.5, borderColor: colors.gold, alignItems: "center", justifyContent: "center" }}>
                <Dumbbell size={22} color={colors.gold} strokeWidth={1.9} />
              </View>
              <Text style={{ marginTop: 14, fontFamily: "Geist_700Bold", fontSize: 16, color: colors.white, textAlign: "center" }}>
                No workouts logged yet
              </Text>
              <Text style={{ marginTop: 6, fontSize: 12.5, lineHeight: 18, color: colors.fog, textAlign: "center" }}>
                Start a workout to log your lifts and cardio. PRs earn trophies.
              </Text>
            </View>
          ) : (
            (workouts.data ?? []).map((w) => <WorkoutSummaryCard key={w.id} workout={w} />)
          )}
        </ScrollView>
      ) : tab === "Communities" ? (
        <ScrollView contentContainerStyle={{ paddingBottom: NAV_H + insets.bottom + 12 }}>
          <SectionLabel style={{ paddingTop: 2 }}>Your gyms</SectionLabel>
          {homeGym ? (
            <Pressable onPress={openHomeGym} style={{ marginHorizontal: 18, marginBottom: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderWidth: 1,
                  borderColor: colors.iron,
                  borderRadius: 16,
                  backgroundColor: colors.graphite,
                  padding: 14
                }}
              >
                <View style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
                  <Dumbbell size={18} color={colors.mist} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>{homeGym.name}</Text>
                  <Text style={{ marginTop: 2, fontSize: 12, color: colors.fog }}>Your home gym</Text>
                </View>
                <TypePill>GYM</TypePill>
              </View>
            </Pressable>
          ) : (
            <Text style={{ paddingHorizontal: 18, paddingBottom: 10, fontSize: 12.5, color: colors.fog }}>
              No home gym set yet. Pick one in onboarding or when you post.
            </Text>
          )}

          <SectionLabel>Your communities</SectionLabel>
          {communities.isLoading ? (
            <View style={{ paddingVertical: 20, alignItems: "center" }}>
              <ActivityIndicator color={colors.mist} />
            </View>
          ) : (communities.data ?? []).length === 0 ? (
            <Text style={{ paddingHorizontal: 18, paddingBottom: 12, fontSize: 12.5, lineHeight: 18, color: colors.fog }}>
              You're not in any communities yet. Join your gym from the map, or start your own below.
            </Text>
          ) : (
            (communities.data ?? []).map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))
          )}

          <View style={{ paddingHorizontal: 18, paddingTop: 8, gap: 10 }}>
            <Button
              variant="ghost"
              icon={<Plus size={16} color={colors.bone} />}
              onPress={() => router.push("/community-new" as Href)}
            >
              Start a community
            </Button>
            <Button
              variant="ghost"
              icon={<KeyRound size={16} color={colors.bone} />}
              onPress={() => sheet.open(<InviteCodeSheet />)}
            >
              Enter invite code
            </Button>
          </View>

          {/* Discover (20): public communities only — private ones are
              invite-code-only and never listed. */}
          <SectionLabel style={{ paddingTop: 22 }}>Discover</SectionLabel>
          <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
            <SearchBar value={discoverQuery} onChangeText={setDiscoverQuery} placeholder="Search public communities" />
          </View>
          {discover.isLoading ? (
            <View style={{ paddingVertical: 18, alignItems: "center" }}>
              <ActivityIndicator color={colors.mist} />
            </View>
          ) : (discover.data ?? []).length === 0 ? (
            <Text style={{ paddingHorizontal: 18, paddingBottom: 12, fontSize: 12.5, color: colors.fog }}>
              {discoverQuery.trim() ? "No public communities match that name." : "Nothing to discover yet — start one above."}
            </Text>
          ) : (
            (discover.data ?? []).slice(0, 15).map((community) => (
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
            <MapCanvas gyms={mapGyms.data ?? []} coords={coords} onGym={openGym} onCluster={openCluster} />
          )}
        </View>
      )}
    </View>
  );

  function WorkoutSummaryCard({ workout }: { workout: WorkoutRow }) {
    const when = new Date(workout.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const stats: string[] = [];
    if (workout.totalVolume > 0) stats.push(`${workout.totalVolume.toLocaleString()} lb`);
    stats.push(`${workout.totalSets} sets`);
    if (workout.cardioMinutes > 0) stats.push(`${workout.cardioMinutes} min cardio`);
    stats.push(fmtClock(workout.durationSeconds));
    return (
      <Pressable onPress={() => router.push(`/workout/${workout.id}` as Href)} style={{ marginHorizontal: 18, marginBottom: 10 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderWidth: 1,
            borderColor: colors.iron,
            borderRadius: 16,
            backgroundColor: colors.graphite,
            padding: 14
          }}
        >
          <View style={{ width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
            <Dumbbell size={18} color={colors.mist} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text numberOfLines={1} style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }}>
              {workout.name}
            </Text>
            <Text style={{ marginTop: 2, fontSize: 12, color: colors.fog }}>
              {when} · {stats.join(" · ")}
            </Text>
          </View>
          {workout.exerciseCount > 0 ? <TypePill>{`${workout.exerciseCount}`}</TypePill> : null}
        </View>
      </Pressable>
    );
  }

  function DiscoverCard({ community }: { community: CommunitySummary }) {
    const Icon = COMMUNITY_ICONS[community.type];
    return (
      <Pressable
        onPress={() => router.push(`/community/${community.id}` as Href)}
        style={{ marginHorizontal: 18, marginBottom: 10 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderWidth: 1,
            borderColor: colors.iron,
            borderRadius: 16,
            backgroundColor: colors.graphite,
            padding: 12
          }}
        >
          <View style={{ width: 46, height: 46, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.slate, backgroundColor: colors.charcoal, alignItems: "center", justifyContent: "center" }}>
            {community.photoUrl ? (
              <Image source={{ uri: community.photoUrl }} contentFit="cover" style={{ width: 46, height: 46 }} />
            ) : (
              <Icon size={18} color={colors.mist} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14, color: colors.white }} numberOfLines={1}>
              {community.name}
            </Text>
            <View style={{ marginTop: 3, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
              <Users size={11} color={colors.fog} strokeWidth={2} />
              <Text style={{ fontSize: 11.5, color: colors.fog }}>{`${community.memberCount}`}</Text>
              {community.location ? (
                <>
                  <Text style={{ fontSize: 11.5, color: colors.iron }}>·</Text>
                  <MapPin size={11} color={colors.fog} strokeWidth={2} />
                  <Text style={{ fontSize: 11.5, color: colors.fog }} numberOfLines={1}>
                    {community.location}
                  </Text>
                </>
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
          >
            <View style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white }}>
              <Text style={{ fontFamily: "Geist_700Bold", fontSize: 12.5, color: colors.black }}>Join</Text>
            </View>
          </Pressable>
        </View>
      </Pressable>
    );
  }

  function CommunityCard({ community }: { community: CommunitySummary }) {
    const Icon = COMMUNITY_ICONS[community.type];
    return (
      <Pressable
        onPress={() => router.push(`/community/${community.id}` as Href)}
        style={{ marginHorizontal: 18, marginBottom: 10 }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            borderWidth: 1,
            borderColor: colors.iron,
            borderRadius: 16,
            backgroundColor: colors.graphite,
            padding: 12
          }}
        >
          {/* Photo, or the type icon as a fallback. */}
          <View style={{ width: 52, height: 52, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: colors.slate, backgroundColor: colors.charcoal, alignItems: "center", justifyContent: "center" }}>
            {community.photoUrl ? (
              <Image source={{ uri: community.photoUrl }} contentFit="cover" style={{ width: 52, height: 52 }} />
            ) : (
              <Icon size={20} color={colors.mist} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Geist_700Bold", fontSize: 14.5, color: colors.white }} numberOfLines={1}>
              {community.name}
            </Text>
            <View style={{ marginTop: 3, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 4 }}>
              <Users size={11} color={colors.fog} strokeWidth={2} />
              <Text style={{ fontSize: 11.5, color: colors.fog }}>
                {`${community.memberCount}`}
              </Text>
              <Text style={{ fontSize: 11.5, color: colors.iron }}>·</Text>
              <Grid3x3 size={11} color={colors.fog} strokeWidth={2} />
              <Text style={{ fontSize: 11.5, color: colors.fog }}>{`${community.postCount}`}</Text>
              {community.location ? (
                <>
                  <Text style={{ fontSize: 11.5, color: colors.iron }}>·</Text>
                  <MapPin size={11} color={colors.fog} strokeWidth={2} />
                  <Text style={{ fontSize: 11.5, color: colors.fog }} numberOfLines={1}>
                    {community.location}
                  </Text>
                </>
              ) : null}
            </View>
          </View>
          <Pressable
            onPress={() => router.push(`/community/${community.id}?tab=Chat` as Href)}
            accessibilityLabel={`Open ${community.name} chat`}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
              <MessageCircle size={16} color={colors.mist} />
            </View>
          </Pressable>
        </View>
      </Pressable>
    );
  }
}
