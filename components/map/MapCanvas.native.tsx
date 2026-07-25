import { Dumbbell } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type MapStyleElement, type Region } from "react-native-maps";

import type { MapGym } from "@/hooks/queries/useMapGyms";
import { colors } from "@/theme/colors";

const darkMapStyle: MapStyleElement[] = [
  { elementType: "geometry", stylers: [{ color: colors.ink }] },
  { elementType: "labels.text.fill", stylers: [{ color: colors.fog }] },
  { elementType: "labels.text.stroke", stylers: [{ color: colors.black }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: colors.charcoal }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: colors.graphite }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: colors.black }] }
];

/** Orange County fallback center when device location is unavailable. */
const OC_CENTER = { latitude: 33.66, longitude: -117.78 };
const LON_SCALE = Math.cos((33.7 * Math.PI) / 180);

/**
 * Hard cap on simultaneously mounted markers. The previous design mounted
 * every tier's markers up front (~400-700 views) and toggled opacity —
 * react-native-maps crashed on fast zoom-out no matter how the churn was
 * trimmed. Viewport rendering keeps the native map at double-digit marker
 * counts at all times.
 */
const MAX_MARKERS = 90;

/** Below this latitudeDelta (≈2km tall viewport) show individual pins only. */
const NO_CLUSTER_DELTA = 0.02;

type Cluster = { id: string; latitude: number; longitude: number; gyms: MapGym[] };

/**
 * Distance-based greedy clustering (NOT grid): each gym joins the nearest
 * existing cluster within `radius` (degrees), else starts a new one; a merge
 * pass then combines clusters that ended up within 0.9*radius. Grid bucketing
 * was the old bug — two gyms straddling a cell edge produced overlapping
 * bubbles. Bounded full-sweep merge passes (not restart-on-every-merge).
 */
function clusterGyms(gyms: MapGym[], radius: number): Cluster[] {
  const acc: { latSum: number; lonSum: number; gyms: MapGym[] }[] = [];
  const sorted = [...gyms].sort((a, b) => a.latitude - b.latitude || a.longitude - b.longitude);
  for (const gym of sorted) {
    let best: (typeof acc)[number] | null = null;
    let bestD = Infinity;
    for (const c of acc) {
      const n = c.gyms.length;
      const d = Math.hypot(gym.latitude - c.latSum / n, (gym.longitude - c.lonSum / n) * LON_SCALE);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    if (best && bestD <= radius) {
      best.latSum += gym.latitude;
      best.lonSum += gym.longitude;
      best.gyms.push(gym);
    } else {
      acc.push({ latSum: gym.latitude, lonSum: gym.longitude, gyms: [gym] });
    }
  }
  let changed = true;
  let guard = 0;
  while (changed && guard++ < 20) {
    changed = false;
    for (let i = 0; i < acc.length; i++) {
      for (let j = i + 1; j < acc.length; j++) {
        const a = acc[i];
        const b = acc[j];
        const d = Math.hypot(
          a.latSum / a.gyms.length - b.latSum / b.gyms.length,
          (a.lonSum / a.gyms.length - b.lonSum / b.gyms.length) * LON_SCALE
        );
        if (d < radius * 0.9) {
          a.latSum += b.latSum;
          a.lonSum += b.lonSum;
          a.gyms.push(...b.gyms);
          acc.splice(j, 1);
          j -= 1;
          changed = true;
        }
      }
    }
  }
  return acc.map((c) => ({
    // Key encodes everything the marker DISPLAYS (anchor gym + count), so a
    // marker's children never change under tracksViewChanges={false}. When
    // membership shifts, the key shifts → clean remount of that one marker.
    id: `${c.gyms[0].id}-${c.gyms.length}`,
    latitude: c.latSum / c.gyms.length,
    longitude: c.lonSum / c.gyms.length,
    gyms: c.gyms
  }));
}

/**
 * VIEWPORT-RENDERED MAP — the standard production pattern. Only markers
 * inside the visible region (plus margin) are mounted, capped at MAX_MARKERS,
 * recomputed 250ms after each region change settles (never mid-gesture).
 * Cluster radius scales with zoom so bubbles merge exactly the gyms whose
 * pins would overlap on screen — nothing merges "from far away".
 */
export function MapCanvas({
  gyms,
  coords,
  onGym,
  onCluster
}: {
  gyms: MapGym[];
  coords: { latitude: number; longitude: number } | null;
  onGym: (gym: MapGym) => void;
  onCluster: (gyms: MapGym[]) => void;
}) {
  const initial = useRef<Region | null>(null);
  if (!initial.current) {
    const center = coords ?? OC_CENTER;
    const delta = coords ? 0.05 : 0.45;
    initial.current = {
      latitude: center.latitude,
      longitude: center.longitude,
      latitudeDelta: delta,
      longitudeDelta: delta
    };
  }
  const [region, setRegion] = useState<Region>(initial.current);

  // Debounce region updates: fast pinches fire several region-complete events
  // back to back; markers recompute once, after the map has been quiet.
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pending.current) clearTimeout(pending.current);
  }, []);
  const scheduleRegion = (next: Region) => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = setTimeout(() => setRegion(next), 250);
  };

  // Stable callbacks so memoized markers don't re-render on parent renders.
  const onGymRef = useRef(onGym);
  onGymRef.current = onGym;
  const onClusterRef = useRef(onCluster);
  onClusterRef.current = onCluster;
  const pressGym = useCallback((gym: MapGym) => onGymRef.current(gym), []);
  const pressCluster = useCallback((clusterGyms: MapGym[]) => onClusterRef.current(clusterGyms), []);

  const markers = useMemo(() => {
    // Visible bbox with 40% margin each side so panning has pins ready.
    const latPad = region.latitudeDelta * 0.7;
    const lonPad = region.longitudeDelta * 0.7;
    const visible = gyms.filter(
      (g) =>
        Math.abs(g.latitude - region.latitude) < latPad &&
        Math.abs(g.longitude - region.longitude) < lonPad
    );
    // Merge radius ≈ one bubble-width at this zoom (34px of ~700px viewport),
    // so bubbles combine only gyms whose pins would overlap on screen.
    const radius = region.latitudeDelta * 0.05;
    const clusters =
      region.latitudeDelta <= NO_CLUSTER_DELTA
        ? visible.map((g) => ({ id: g.id, latitude: g.latitude, longitude: g.longitude, gyms: [g] }))
        : clusterGyms(visible, radius);
    // Cap: keep the clusters nearest the view center.
    clusters.sort(
      (a, b) =>
        Math.hypot(a.latitude - region.latitude, (a.longitude - region.longitude) * LON_SCALE) -
        Math.hypot(b.latitude - region.latitude, (b.longitude - region.longitude) * LON_SCALE)
    );
    return clusters.slice(0, MAX_MARKERS);
  }, [gyms, region]);

  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      customMapStyle={darkMapStyle}
      showsCompass={false}
      showsUserLocation
      showsMyLocationButton={false}
      // Cap zoom-out (~level 9 ≈ 80km across — the whole county). Only the
      // ~250 gyms nearest the viewer are loaded, so wider zoom adds nothing.
      minZoomLevel={9}
      initialRegion={initial.current}
      onRegionChangeComplete={scheduleRegion}
      style={{ flex: 1 }}
    >
      {markers.map((cluster) =>
        cluster.gyms.length === 1 ? (
          <SinglePin key={cluster.gyms[0].id} gym={cluster.gyms[0]} onPress={pressGym} />
        ) : (
          <ClusterPin key={cluster.id} cluster={cluster} onPress={pressCluster} />
        )
      )}
    </MapView>
  );
}

const SinglePin = memo(function SinglePin({
  gym,
  onPress
}: {
  gym: MapGym;
  onPress: (gym: MapGym) => void;
}) {
  return (
    <Marker
      coordinate={{ latitude: gym.latitude, longitude: gym.longitude }}
      onPress={() => onPress(gym)}
      tracksViewChanges={false}
    >
      <GymMarker />
    </Marker>
  );
});

const ClusterPin = memo(function ClusterPin({
  cluster,
  onPress
}: {
  cluster: Cluster;
  onPress: (gyms: MapGym[]) => void;
}) {
  return (
    <Marker
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      onPress={() => onPress(cluster.gyms)}
      tracksViewChanges={false}
    >
      <ClusterMarker count={cluster.gyms.length} />
    </Marker>
  );
});

function GymMarker() {
  return (
    <View style={{ width: 34, height: 34, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 15,
          borderWidth: 2,
          borderColor: colors.white,
          backgroundColor: colors.ink,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Dumbbell size={13} color={colors.white} />
      </View>
    </View>
  );
}

function ClusterMarker({ count }: { count: number }) {
  // Scale gently with size so a 50-gym bubble reads bigger than a 3-gym one,
  // but never large enough to overlap neighbours at its zoom.
  const size = count >= 25 ? 44 : count >= 8 ? 40 : 34;
  return (
    <View style={{ width: size + 4, height: size + 4, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: colors.white,
          backgroundColor: colors.ink,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <Text
          allowFontScaling={false}
          style={{ fontFamily: "GeistMono_500Medium", fontSize: count >= 25 ? 15 : 13, color: colors.white }}
        >
          {count}
        </Text>
      </View>
    </View>
  );
}
