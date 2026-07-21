import { BlurView } from "expo-blur";
import * as Location from "expo-location";
import { router } from "expo-router";
import { LocateFixed, MapPin, Search } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, Linking, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type MapStyleElement } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AvatarPin } from "@/components/AvatarPin";
import { Pressable } from "@/components/ui/Pressable";
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
  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      let current = await Location.getForegroundPermissionsAsync();
      if (!active) return;
      if (current.status !== "granted" && current.canAskAgain) {
        current = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
      }
      setPermission(current.status);
      if (current.status === "granted") {
        try {
          const cached = await Location.getLastKnownPositionAsync();
          if (cached && active) {
            const coord = { latitude: cached.coords.latitude, longitude: cached.coords.longitude };
            setUserLocation(coord);
            mapRef.current?.animateToRegion(
              { ...coord, latitudeDelta: 0.012, longitudeDelta: 0.012 },
              350
            );
          }
          const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!active) return;
          const coord = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
          setUserLocation(coord);
          mapRef.current?.animateToRegion(
            { ...coord, latitudeDelta: 0.012, longitudeDelta: 0.012 },
            500
          );
        } catch {
          // ignore — user may have toggled location off mid-session
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function ensureLocation(): Promise<{ latitude: number; longitude: number } | null> {
    let status = permission;
    if (status !== "granted") {
      const result = await Location.requestForegroundPermissionsAsync();
      setPermission(result.status);
      status = result.status;
    }
    if (status !== "granted") {
      Alert.alert(
        "Location off",
        "Spotted needs location to verify gym check-ins. Enable it in Settings.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Open Settings", onPress: () => Linking.openSettings() }
        ]
      );
      return null;
    }
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const coord = { latitude: fix.coords.latitude, longitude: fix.coords.longitude };
    setUserLocation(coord);
    return coord;
  }

  async function handleImHere() {
    const coord = await ensureLocation();
    if (!coord) return;
    mapRef.current?.animateToRegion(
      { ...coord, latitudeDelta: 0.012, longitudeDelta: 0.012 },
      400
    );
  }

  return (
    <View className="flex-1 bg-black">
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        customMapStyle={darkMapStyle}
        showsUserLocation={permission === "granted"}
        showsMyLocationButton={false}
        showsCompass={false}
        initialRegion={{
          latitude: userLocation?.latitude ?? initial?.latitude ?? 40.7472,
          longitude: userLocation?.longitude ?? initial?.longitude ?? -73.9935,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04
        }}
        style={{ flex: 1 }}
      >
        {data?.gyms.map((gym) => (
          <Marker
            key={gym.id}
            coordinate={{ latitude: gym.latitude, longitude: gym.longitude }}
            onPress={() => router.push(`/gym/${gym.id}`)}
          >
            <View className="overflow-hidden rounded-pill border border-hairline-strong">
              <View className="bg-black/80 px-3 py-1.5">
                <Text variant="micro" className="text-white">
                  {gym.name}
                </Text>
              </View>
            </View>
          </Marker>
        ))}
        {data?.presence.map((item) => {
          const coordinate = jitterGymCoordinate(
            { latitude: item.gym.latitude, longitude: item.gym.longitude },
            item.id
          );
          return (
            <Marker key={item.id} coordinate={coordinate}>
              <AvatarPin uri={item.profile.avatar_url} name={item.profile.display_name} />
            </Marker>
          );
        })}
      </MapView>

      <View
        className="absolute left-4 right-4 overflow-hidden rounded-pill border border-hairline-strong"
        style={{ top: insets.top + 12 }}
      >
        <BlurView intensity={48} tint="dark" className="absolute inset-0" />
        <Pressable className="flex-row items-center gap-3 bg-glass-soft px-4 py-3" haptic={false}>
          <Search color={colors.fog} size={18} />
          <Text variant="caption" className="flex-1 text-mist">
            Search usernames or gyms
          </Text>
        </Pressable>
      </View>

      {initial ? (
        <View
          className="absolute left-4 overflow-hidden rounded-pill border border-hairline-strong"
          style={{ top: insets.top + 70 }}
        >
          <BlurView intensity={40} tint="dark" className="absolute inset-0" />
          <View className="flex-row items-center gap-2 bg-glass-soft px-3 py-1.5">
            <MapPin color={colors.mist} size={13} strokeWidth={2} />
            <Text variant="micro" className="text-white">
              {initial.name.toUpperCase()}
            </Text>
          </View>
        </View>
      ) : null}

      <View
        className="absolute right-4"
        style={{ bottom: insets.bottom + 110 }}
      >
        <Pressable
          className="h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-hairline-strong"
          onPress={handleImHere}
          accessibilityLabel="Center on my location"
        >
          <BlurView intensity={48} tint="dark" className="absolute inset-0" />
          <View className="absolute inset-0 bg-glass-soft" />
          <LocateFixed color={colors.white} size={20} strokeWidth={1.8} />
        </Pressable>
      </View>

      {permission !== "granted" ? (
        <View
          className="absolute left-4 right-4 overflow-hidden rounded-card border border-hairline-strong"
          style={{ bottom: insets.bottom + 110 + 56 }}
        >
          <BlurView intensity={48} tint="dark" className="absolute inset-0" />
          <View className="bg-black/40 p-4">
            <Text variant="micro" className="text-mist">
              LOCATION OFF
            </Text>
            <Text variant="caption" className="mt-1 text-white">
              Tap the locate button to verify gym check-ins.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}
