import * as Location from "expo-location";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CommunitiesHub } from "@/components/communities/CommunitiesHub";
import { InviteCodeSheet } from "@/components/communities/InviteCodeSheet";
import { GymPreviewSheet } from "@/components/map/GymPreviewSheet";
import { GymRow } from "@/components/map/GymRow";
import { GymSearchBar } from "@/components/map/GymSearchBar";
import { MapCanvas } from "@/components/map/MapCanvas";
import { Segmented } from "@/components/ui/Segmented";
import { SheetSub, SheetTitle, useSheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { boundsAround, nearestGyms, useMapGyms, type MapBounds, type MapGym } from "@/hooks/queries/useMapGyms";
import { logger } from "@/lib/logger";
import { colors } from "@/theme/colors";
import { tabBarClearance } from "@/theme/layout";
import { space } from "@/theme/tokens";

/** Gyms stacked under one cluster bubble at max zoom — pick one. */
function ClusterSheet({ gyms, onGym }: { gyms: MapGym[]; onGym: (gym: MapGym) => void }) {
  const shown = gyms.slice(0, 12);
  return (
    <View>
      <SheetTitle>{`${gyms.length} gyms here`}</SheetTitle>
      <SheetSub>Zoom in on the map, or pick one below.</SheetSub>
      {shown.map((gym) => (
        <GymRow key={gym.id} gym={gym} onPress={() => onGym(gym)} />
      ))}
      {gyms.length > shown.length ? (
        <Text variant="meta" className="px-6 pt-2 pb-1">
          {`+ ${gyms.length - shown.length} more — zoom in to see them all`}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Communities / Map tab. Communities is the default; Map shows gym presence
 * (gym-level only — never a user's location) on the GL canvas.
 */
export default function MapTabScreen() {
  const insets = useSafeAreaInsets();
  const sheet = useSheet();
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
        logger.warn("map_location_failed", { message: error instanceof Error ? error.message : String(error) });
      } finally {
        if (!cancelled) setLocationSettled(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Viewport-driven gyms: the map reports its settled region; useMapGyms
  // fetches that tile (cached 24h + persisted). Until the map reports, fetch a
  // ~40km box around the user.
  const [viewBounds, setViewBounds] = useState<MapBounds | null>(null);
  const mapGyms = useMapGyms(locationSettled ? (viewBounds ?? boundsAround(coords)) : null);

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
        ? {
            latitude: (viewBounds.minLat + viewBounds.maxLat) / 2,
            longitude: (viewBounds.minLng + viewBounds.maxLng) / 2
          }
        : coords;
      const kept = nearestGyms([...gymPoolRef.current.values()], center, 5000);
      gymPoolRef.current = new Map(kept.map((gym) => [gym.id, gym]));
    }
    if (changed) setGymPoolVersion((v) => v + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapGymData]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const gymsForMap = useMemo(() => [...gymPoolRef.current.values()], [gymPoolVersion]);

  const openGym = (gym: MapGym) => sheet.open(<GymPreviewSheet gym={gym} close={sheet.close} />);
  const openCluster = (clusterGyms: MapGym[]) => sheet.open(<ClusterSheet gyms={clusterGyms} onGym={openGym} />);

  return (
    <View style={{ flex: 1, backgroundColor: colors.black, paddingTop: insets.top + space[2] }}>
      <View style={{ paddingHorizontal: space[4], paddingBottom: space[1] }}>
        <Text variant="screen-title">{tab}</Text>
      </View>
      <Segmented
        options={["Communities", "Map"]}
        value={tab}
        onChange={setTab}
        style={{ marginTop: space[2], marginBottom: space[3] }}
      />
      {tab === "Communities" ? (
        <CommunitiesHub onEnterCode={() => sheet.open(<InviteCodeSheet />)} onFindGym={() => setTab("Map")} />
      ) : (
        <View style={{ flex: 1, paddingBottom: tabBarClearance(insets.bottom, 0) }}>
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
