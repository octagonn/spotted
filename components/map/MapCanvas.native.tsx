import { Dumbbell } from "lucide-react-native";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type MapStyleElement } from "react-native-maps";

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

type Cluster = { id: string; latitude: number; longitude: number; gyms: MapGym[] };
type Tier = { key: string; clusters: Cluster[] };

/**
 * Distance-based greedy clustering (NOT grid): each gym joins the nearest
 * existing cluster within `radius` (degrees), else starts a new one; a merge
 * pass then combines clusters that ended up within 0.9*radius. Grid bucketing
 * was the old bug — two gyms straddling a cell edge produced overlapping
 * bubbles. This guarantees cluster centers are ≥~radius apart.
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
  // Merge clusters that ended up within 0.9*radius. Bounded full-sweep passes
  // (NOT restart-on-every-merge, which was O(n³) and froze the JS thread at
  // ~600+ gyms); each pass keeps scanning after a merge, repeating until stable.
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
  return acc.map((c, index) => ({
    id: `c${index}`,
    latitude: c.latSum / c.gyms.length,
    longitude: c.lonSum / c.gyms.length,
    gyms: c.gyms
  }));
}

/**
 * Tier radii (degrees) + the latitudeDelta at which each activates. Each
 * radius is ~0.075×(its activation delta), which keeps bubble centers ≥~50px
 * apart (no overlap) at that zoom while merging only genuinely-close gyms:
 * far ≈5km, mid ≈1.5km, cmid ≈0.7km, near ≈0.3km. Tighter + one more tier than
 * before, so zooming out no longer collapses far-apart gyms into one bubble.
 */
const TIERS_DEF = [
  { key: "far", radius: 0.045 },
  { key: "mid", radius: 0.014 },
  { key: "cmid", radius: 0.0065 },
  { key: "near2", radius: 0.0028 }
] as const;

function tierForDelta(delta: number): number {
  if (delta >= 0.35) return 0; // far
  if (delta >= 0.16) return 1; // mid
  if (delta >= 0.075) return 2; // cmid
  if (delta >= 0.035) return 3; // near2
  return 4; // individual pins
}

/** Individual-pins tier index (one past the cluster tiers). */
const PIN_TIER = TIERS_DEF.length;

/**
 * STABILITY CONTRACT — no native marker view is EVER added or removed after
 * mount (new-arch react-native-maps hard-crashes Expo Go otherwise). All
 * markers are mounted once; changing zoom only toggles per-marker `opacity`
 * (NOT zIndex — zIndex changes force native view reordering across every
 * marker, which crashed on fast zoom). Parent mounts this only after
 * location + gyms settle; initialRegion is final (no animateToRegion).
 *
 * Marker-count discipline (fast zoom-out crashed at ~700 mounted views):
 * - Single-gym clusters are NOT mounted per tier — they'd render identically
 *   to the gym's individual pin, so that pin is reused (made visible) at any
 *   tier where the gym clusters alone. Only multi-gym bubbles mount per tier.
 * - Tier flips are debounced so a fast pinch from street to far applies one
 *   visibility update, not four cascading re-renders mid-gesture.
 * - Pins/bubbles are memoized so a flip re-renders only markers whose
 *   visibility actually changed.
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
  const frozen = useRef<{
    tiers: Tier[];
    soloAtTier: Set<string>[]; // per tier: gym ids that cluster alone
    gyms: MapGym[];
    coords: typeof coords;
  } | null>(null);
  if (!frozen.current) {
    const tiers = TIERS_DEF.map((t) => ({ key: t.key, clusters: clusterGyms(gyms, t.radius) }));
    const soloAtTier = tiers.map((t) => {
      const solo = new Set<string>();
      for (const c of t.clusters) if (c.gyms.length === 1) solo.add(c.gyms[0].id);
      return solo;
    });
    frozen.current = { tiers, soloAtTier, gyms, coords };
  }
  const data = frozen.current;
  const center = data.coords ?? OC_CENTER;
  const initialDelta = data.coords ? 0.05 : 0.45;
  const [tier, setTier] = useState<number>(tierForDelta(initialDelta));

  // Coalesce rapid tier flips (fast pinch fires several region-complete
  // events back to back) into a single visibility update, applied only after
  // the map has been quiet for a beat — never mid-gesture.
  const pendingTier = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (pendingTier.current) clearTimeout(pendingTier.current);
  }, []);
  const scheduleTier = (next: number) => {
    if (pendingTier.current) clearTimeout(pendingTier.current);
    pendingTier.current = setTimeout(() => {
      setTier((prev) => (prev === next ? prev : next));
    }, 220);
  };

  // Stable callbacks so memoized markers never re-render from prop identity.
  const onGymRef = useRef(onGym);
  onGymRef.current = onGym;
  const onClusterRef = useRef(onCluster);
  onClusterRef.current = onCluster;
  const pressGym = useCallback((gym: MapGym) => onGymRef.current(gym), []);
  const pressCluster = useCallback((clusterGyms: MapGym[]) => onClusterRef.current(clusterGyms), []);

  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      customMapStyle={darkMapStyle}
      showsCompass={false}
      showsUserLocation
      showsMyLocationButton={false}
      // Cap zoom-out (~level 9 ≈ 80km across — the whole county). The map only
      // loads the ~250 gyms nearest the viewer, so zooming further shows
      // nothing new; unbounded fast zoom-out was also the crash trigger
      // (hundreds of annotation updates while MapKit rescales to state view).
      minZoomLevel={9}
      initialRegion={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: initialDelta,
        longitudeDelta: initialDelta
      }}
      onRegionChangeComplete={(region) => scheduleTier(tierForDelta(region.latitudeDelta))}
      style={{ flex: 1 }}
    >
      {data.tiers.map((t, tierIndex) =>
        t.clusters
          .filter((cluster) => cluster.gyms.length > 1)
          .map((cluster) => (
            <ClusterPin
              key={`${t.key}-${cluster.id}`}
              cluster={cluster}
              on={tier === tierIndex}
              onPress={pressCluster}
            />
          ))
      )}
      {data.gyms.map((gym) => (
        <SinglePin
          key={`pin-${gym.id}`}
          gym={gym}
          on={tier === PIN_TIER || data.soloAtTier[tier].has(gym.id)}
          onPress={pressGym}
        />
      ))}
    </MapView>
  );
}

const SinglePin = memo(function SinglePin({
  gym,
  on,
  onPress
}: {
  gym: MapGym;
  on: boolean;
  onPress: (gym: MapGym) => void;
}) {
  return (
    <Marker
      coordinate={{ latitude: gym.latitude, longitude: gym.longitude }}
      onPress={() => on && onPress(gym)}
      opacity={on ? 1 : 0}
      tracksViewChanges={false}
    >
      <GymMarker />
    </Marker>
  );
});

const ClusterPin = memo(function ClusterPin({
  cluster,
  on,
  onPress
}: {
  cluster: Cluster;
  on: boolean;
  onPress: (gyms: MapGym[]) => void;
}) {
  return (
    <Marker
      coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
      onPress={() => on && onPress(cluster.gyms)}
      opacity={on ? 1 : 0}
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
  // but never large enough to overlap neighbours at its tier.
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
