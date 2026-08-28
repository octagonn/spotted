import { Dumbbell } from "lucide-react-native";
import { ScrollView, Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import type { MapBounds, MapGym } from "@/hooks/queries/useMapGyms";
import { colors } from "@/theme/colors";

/**
 * Web fallback — react-native-maps is native-only, so the browser build lists
 * gyms instead of rendering a map.
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
          (a.latitude - coords.latitude) ** 2 + (a.longitude - coords.longitude) ** 2 -
          ((b.latitude - coords.latitude) ** 2 + (b.longitude - coords.longitude) ** 2)
      )
    : gyms;
  return (
    <View style={{ flex: 1, backgroundColor: "#0C0C0E" }}>
      <Text
        style={{
          padding: 18,
          fontFamily: "GeistMono_400Regular",
          fontSize: 10,
          letterSpacing: 1.4,
          color: colors.slate
        }}
      >
        MAP IS NATIVE-ONLY — GYM LIST BELOW
      </Text>
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {sorted.map((gym) => (
          <Pressable key={gym.id} onPress={() => onGym(gym)}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 18 }}>
              <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.mist, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}>
                <Dumbbell size={14} color={colors.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 13.5, color: colors.bone }}>{gym.name}</Text>
                {gym.address ? <Text style={{ marginTop: 1, fontSize: 11, color: colors.fog }}>{gym.address}</Text> : null}
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
