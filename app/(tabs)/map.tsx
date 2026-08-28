import * as Location from "expo-location";
import { GymLogo } from "@/components/GymLogo";
import { useRouter, type Href } from "expo-router";
import { Dumbbell } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CommunitiesHub } from "@/components/communities/CommunitiesHub";
import { GymPreviewSheet } from "@/components/map/GymPreviewSheet";
import { GymSearchBar } from "@/components/map/GymSearchBar";
import { MapCanvas } from "@/components/map/MapCanvas";
import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { SheetTextInput } from "@/components/ui/SheetTextInput";
import { Segmented } from "@/components/ui/Segmented";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { useJoinByCode } from "@/hooks/queries/useCommunities";
import { boundsAround, nearestGyms, useMapGyms, type MapBounds, type MapGym } from "@/hooks/queries/useMapGyms";
import { logger } from "@/lib/logger";
import { showToast } from "@/stores/ui";
import { colors } from "@/theme/colors";

const NAV_H = 84;
const DISP = "Geist_700Bold";

/** Tiny letterspaced caps label. */
function ClusterSheet({ gyms, onGym }: { gyms: MapGym[]; onGym: (gym: MapGym) => void }) {
  const shown = gyms.slice(0, 12);
  return (
    <View>
      <SheetTitle>{`${gyms.length} gyms here`}</SheetTitle>
      <SheetSub>Zoom in on the map, or pick one below.</SheetSub>
      {shown.map((gym) => (
        <Pressable key={gym.id} onPress={() => onGym(gym)}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, paddingHorizontal: 20 }}>
            <GymLogo
              gym={gym}
              size={34}
              fallback={
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.slate, alignItems: "center", justifyContent: "center" }}>
                  <Dumbbell size={14} color={colors.mist} />
                </View>
              }
            />
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
  const router = useRouter();
  const sheet = useSheet();
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
export default function MapTabScreen() {
  const insets = useSafeAreaInsets();
  const sheet = useSheet();

  // Communities is the default — this tab IS the communities tab now;
  // My Workouts lives behind the profile ("My Workouts" button → /my-workouts).
  const [tab, setTab] = useState("Communities");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSettled, setLocationSettled] = useState(false);

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

  // Viewport-driven gyms: the map reports its settled region; useMapGyms
  // fetches that tile via the gyms_in_bounds RPC (cached 24h + persisted to
  // disk — relaunches paint from cache with zero network). Until the map
  // reports, fetch a ~40km box around the user.
  const [viewBounds, setViewBounds] = useState<MapBounds | null>(null);
  const mapGyms = useMapGyms(locationSettled ? viewBounds ?? boundsAround(coords) : null);

  // Accumulate every gym seen this session so pins never vanish behind you
  // while panning; prune to the nearest 5000 if the pool grows past 7000.
  const gymPoolRef = useRef(new Map<string, MapGym>());
  const [gymPoolVersion, setGymPoolVersion] = useState(0);
  const mapGymData = mapGyms.data;
  useEffect(() => {
    if (!mapGymData?.length) return;
    let changed = false;
    for (const gym of mapGymData) {
      if (!gymPoolRef.current.has(gym.id)) {
        gymPoolRef.current.set(gym.id, gym);
        changed = true;
      }
    }
    if (gymPoolRef.current.size > 7000) {
      const center = viewBounds
        ? { latitude: (viewBounds.minLat + viewBounds.maxLat) / 2, longitude: (viewBounds.minLng + viewBounds.maxLng) / 2 }
        : coords;
      const kept = nearestGyms([...gymPoolRef.current.values()], center, 5000);
      gymPoolRef.current = new Map(kept.map((gym) => [gym.id, gym]));
    }
    if (changed) setGymPoolVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapGymData]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gymsForMap = useMemo(() => [...gymPoolRef.current.values()], [gymPoolVersion]);

  const openGym = (gym: MapGym) => {
    sheet.open(<GymPreviewSheet gym={gym} close={sheet.close} />);
  };

  const openCluster = (clusterGyms: MapGym[]) => {
    sheet.open(<ClusterSheet gyms={clusterGyms} onGym={openGym} />);
  };

  /* -------------------------------- render -------------------------------- */

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top + 8 }}>
      <View style={{ paddingHorizontal: 18, paddingBottom: 4 }}>
        <Text accessibilityRole="header" style={{ fontFamily: DISP, fontSize: 22, letterSpacing: 22 * -0.02, color: colors.white }}>
          {tab}
        </Text>
      </View>
      <Segmented options={["Communities", "Map"]} value={tab} onChange={setTab} />
      {tab === "Communities" ? (
        <CommunitiesHub onEnterCode={() => sheet.open(<InviteCodeSheet />)} onFindGym={() => setTab("Map")} />
      ) : (
        <View style={{ flex: 1, paddingBottom: NAV_H + insets.bottom }}>
          {!locationSettled || (mapGyms.isLoading && gymsForMap.length === 0) ? (
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
              <ActivityIndicator color={colors.white} />
            </View>
          ) : (
            <MapCanvas
              gyms={gymsForMap}
              coords={coords}
              onGym={openGym}
              onCluster={openCluster}
              onRegion={setViewBounds}
            />
          )}
          {/* Find a gym by name instead of panning the map hunting for pins. */}
          <GymSearchBar
            coords={coords}
            onPick={(gym) =>
              openGym({
                id: gym.id,
                name: gym.name,
                address: gym.address,
                latitude: gym.latitude,
                longitude: gym.longitude,
                // search_gyms only returns gym/yoga/pilates rows; the sheet
                // does not branch on category, so this is purely structural.
                category: null
              })
            }
          />
        </View>
      )}
    </View>
  );
}

