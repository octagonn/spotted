import { Dumbbell } from "lucide-react-native";
import { useRef, useState } from "react";
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
 * Tier radii + the max latitudeDelta each tier stays clean at, derived from
 * bubble size B and map height H≈700: cleanUpTo = radius*0.9*H/B. Thresholds
 * below sit inside every tier's clean range.
 */
const TIERS_DEF = [
  { key: "far", radius: 0.075 },
  { key: "mid", radius: 0.03 },
  { key: "cmid", radius: 0.012 }
] as const;

function tierForDelta(delta: number): number {
  if (delta >= 0.3) return 0; // far
  if (delta >= 0.12) return 1; // mid
  if (delta >= 0.045) return 2; // cmid
  return 3; // near — individual pins
}

/**
 * STABILITY CONTRACT — no native marker view is EVER added or removed after
 * mount (new-arch react-native-maps hard-crashes Expo Go otherwise). Every
 * tier's clusters AND all individual gyms are mounted once; changing zoom only
 * toggles per-marker `opacity`/`zIndex`. Parent mounts this only after
 * location + gyms settle; initialRegion is final (no animateToRegion).
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
  const frozen = useRef<{ tiers: Tier[]; gyms: MapGym[]; coords: typeof coords } | null>(null);
  if (!frozen.current) {
    frozen.current = {
      tiers: TIERS_DEF.map((t) => ({ key: t.key, clusters: clusterGyms(gyms, t.radius) })),
      gyms,
      coords
    };
  }
  const data = frozen.current;
  const center = data.coords ?? OC_CENTER;
  const initialDelta = data.coords ? 0.05 : 0.45;
  const [tier, setTier] = useState<number>(tierForDelta(initialDelta));

  return (
    <MapView
      provider={PROVIDER_DEFAULT}
      customMapStyle={darkMapStyle}
      showsCompass={false}
      showsUserLocation
      showsMyLocationButton={false}
      initialRegion={{
        latitude: center.latitude,
        longitude: center.longitude,
        latitudeDelta: initialDelta,
        longitudeDelta: initialDelta
      }}
      onRegionChangeComplete={(region) => {
        const next = tierForDelta(region.latitudeDelta);
        setTier((prev) => (prev === next ? prev : next));
      }}
      style={{ flex: 1 }}
    >
      {data.tiers.map((t, tierIndex) =>
        t.clusters.map((cluster) => {
          const on = tier === tierIndex;
          const single = cluster.gyms.length === 1;
          return (
            <Marker
              key={`${t.key}-${cluster.id}`}
              coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
              onPress={() => on && (single ? onGym(cluster.gyms[0]) : onCluster(cluster.gyms))}
              opacity={on ? 1 : 0}
              zIndex={on ? 3 : 0}
              tracksViewChanges={false}
            >
              {single ? <GymMarker /> : <ClusterMarker count={cluster.gyms.length} />}
            </Marker>
          );
        })
      )}
      {data.gyms.map((gym) => {
        const on = tier === 3;
        return (
          <Marker
            key={`near-${gym.id}`}
            coordinate={{ latitude: gym.latitude, longitude: gym.longitude }}
            onPress={() => on && onGym(gym)}
            opacity={on ? 1 : 0}
            zIndex={on ? 3 : 0}
            tracksViewChanges={false}
          >
            <GymMarker />
          </Marker>
        );
      })}
    </MapView>
  );
}

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
