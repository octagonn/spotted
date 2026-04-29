import MapView, { Marker, PROVIDER_DEFAULT, type MapStyleElement } from "react-native-maps";
import { router } from "expo-router";
import { LocateFixed, Search } from "lucide-react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AvatarPin } from "@/components/AvatarPin";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { useGymPresence } from "@/hooks/queries/useGymPresence";
import { jitterGymCoordinate } from "@/lib/geofence";
import { colors } from "@/theme/colors";

const darkMapStyle: MapStyleElement[] = [
  { elementType: "geometry", stylers: [{ color: colors.ink }] },
  { elementType: "labels.text.fill", stylers: [{ color: colors.silver }] },
  { elementType: "labels.text.stroke", stylers: [{ color: colors.black }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: colors.charcoal }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: colors.graphite }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: colors.black }] }
];

export default function GymMapScreen() {
  const insets = useSafeAreaInsets();
  const presence = useGymPresence();
  const data = presence.data;
  const initial = data?.gyms[0];

  return (
    <View className="flex-1 bg-black">
      <MapView
        provider={PROVIDER_DEFAULT}
        customMapStyle={darkMapStyle}
        initialRegion={{
          latitude: initial?.latitude ?? 40.7472,
          longitude: initial?.longitude ?? -73.9935,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04
        }}
        style={{ flex: 1 }}
      >
        {data?.gyms.map((gym) => (
          <Marker key={gym.id} coordinate={{ latitude: gym.latitude, longitude: gym.longitude }} onPress={() => router.push(`/gym/${gym.id}`)}>
            <View className="border border-iron bg-black px-3 py-2">
              <Text variant="micro" className="text-white">
                {gym.name}
              </Text>
              <Text variant="micro">{data.presence.filter((item) => item.gym.id === gym.id).length} FRIENDS HERE</Text>
            </View>
          </Marker>
        ))}
        {data?.presence.map((item) => {
          const coordinate = jitterGymCoordinate({ latitude: item.gym.latitude, longitude: item.gym.longitude }, item.id);
          return (
            <Marker key={item.id} coordinate={coordinate}>
              <AvatarPin uri={item.profile.avatar_url} name={item.profile.display_name} />
            </Marker>
          );
        })}
      </MapView>
      <View className="absolute left-4 right-4 flex-row items-center gap-3 border border-iron bg-black px-4 py-3" style={{ top: insets.top + 16 }}>
        <Search color={colors.fog} size={18} />
        <Text variant="caption" className="flex-1 text-silver">
          Search gyms
        </Text>
      </View>
      <View className="absolute bottom-28 left-4 right-4">
        <Button icon={<LocateFixed color={colors.black} size={18} />}>I'm here</Button>
      </View>
    </View>
  );
}
