import { ScrollView, View } from "react-native";

import { GymRow } from "@/components/map/GymRow";
import { SectionLabel } from "@/components/ui/SectionLabel";
import type { MapBounds, MapGym } from "@/hooks/queries/useMapGyms";
import { colors } from "@/theme/colors";
import { space } from "@/theme/tokens";

/**
 * Web fallback — the GL map is native-only, so the browser build lists gyms
 * (nearest first) instead of rendering a map.
 */
export function MapCanvas({
  gyms,
  coords,
  onGym,
  onCluster: _onCluster,
  onRegion: _onRegion
}: {
  gyms: MapGym[];
  coords: { latitude: number; longitude: number } | null;
  onGym: (gym: MapGym) => void;
  onCluster: (gyms: MapGym[]) => void;
  onRegion?: (bounds: MapBounds) => void;
}) {
  const sorted = coords
    ? [...gyms].sort(
        (a, b) =>
          (a.latitude - coords.latitude) ** 2 +
          (a.longitude - coords.longitude) ** 2 -
          ((b.latitude - coords.latitude) ** 2 + (b.longitude - coords.longitude) ** 2)
      )
    : gyms;
  return (
    <View style={{ flex: 1, backgroundColor: colors.black }}>
      <SectionLabel style={{ paddingHorizontal: space[4], paddingTop: space[4], paddingBottom: space[2] }}>
        Map is native-only — gyms nearby
      </SectionLabel>
      <ScrollView contentContainerStyle={{ paddingBottom: space[6] }}>
        {sorted.map((gym) => (
          <GymRow key={gym.id} gym={gym} onPress={() => onGym(gym)} />
        ))}
      </ScrollView>
    </View>
  );
}
