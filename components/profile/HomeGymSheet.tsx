import * as Location from "expo-location";
import { MapPin, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, View, Text } from "react-native";
import { ScrollView as SheetScrollView } from "react-native-gesture-handler";

import { Pressable } from "@/components/ui/Pressable";
import { SheetTitle } from "@/components/ui/Sheet";
import { SheetTextInput } from "@/components/ui/SheetTextInput";
import { formatDistance, useGymSearch, type GymSearchCoords } from "@/hooks/queries/useGymSearch";
import { logger } from "@/lib/logger";
import { colors } from "@/theme/colors";

const SEARCH_DEBOUNCE_MS = 300;

/** ~11m precision — keeps the query key stable across tiny GPS jitters. */
function roundCoord(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Home-gym picker (edit profile): search nearby gyms and pick one, or remove
 * the current home gym. Selection is returned to the caller — the profile
 * Save button persists it with the rest of the edits.
 */
export function HomeGymSheet({
  hasCurrent,
  onSelect,
  onRemove,
  onClose
}: {
  hasCurrent: boolean;
  onSelect: (gym: { id: string; name: string }) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<GymSearchCoords | null>(null);
  const [locationSettled, setLocationSettled] = useState(false);

  // Nearest-first when location permission was already granted; never prompts.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (permission.granted) {
          const position =
            (await Location.getLastKnownPositionAsync()) ??
            (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
          if (!cancelled && position) {
            setCoords({
              latitude: roundCoord(position.coords.latitude),
              longitude: roundCoord(position.coords.longitude)
            });
          }
        }
      } catch (error) {
        logger.warn("home_gym_sheet_location_failed", {
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

  useEffect(() => {
    const timer = setTimeout(() => setQuery(searchInput), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const gyms = useGymSearch(query, coords, locationSettled);
  const rows = (gyms.data?.pages ?? []).flat();

  return (
    <View style={{ maxHeight: 520 }}>
      <SheetTitle>Home gym</SheetTitle>
      <SheetTextInput
        value={searchInput}
        onChangeText={setSearchInput}
        accessibilityLabel="Search gyms"
        placeholder="Search for your gym"
        placeholderTextColor={colors.fog}
        autoCorrect={false}
        style={{
          marginTop: 12,
          minHeight: 44,
          borderWidth: 1,
          borderColor: colors.iron,
          borderRadius: 12,
          backgroundColor: colors.graphite,
          paddingHorizontal: 14,
          fontSize: 15,
          color: colors.white
        }}
      />
      <SheetScrollView
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        style={{ marginTop: 10 }}
        contentContainerStyle={{ paddingBottom: 16 }}
      >
        {hasCurrent ? (
          <Pressable
            accessibilityLabel="Remove home gym"
            onPress={() => {
              onRemove();
              onClose();
            }}
            haptic={false}
            style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 }}
          >
            <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
              <X size={15} color={colors.silver} strokeWidth={2.2} />
            </View>
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.silver }}>Remove home gym</Text>
          </Pressable>
        ) : null}
        {gyms.isLoading || !locationSettled ? (
          <View style={{ paddingVertical: 28, alignItems: "center" }}>
            <ActivityIndicator color={colors.fog} />
          </View>
        ) : rows.length === 0 ? (
          <Text style={{ paddingVertical: 28, textAlign: "center", fontSize: 13, color: colors.fog }}>
            {query ? `No gyms match "${query}".` : "No gyms yet."}
          </Text>
        ) : (
          rows.map((gym) => {
            const distance = formatDistance(gym.distance_meters);
            return (
              <Pressable
                key={gym.id}
                accessibilityLabel={gym.name}
                onPress={() => {
                  onSelect({ id: gym.id, name: gym.name });
                  onClose();
                }}
                haptic={false}
                style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 }}
              >
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.iron, alignItems: "center", justifyContent: "center" }}>
                  <MapPin size={15} color={colors.white} strokeWidth={1.8} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>
                    {gym.name}
                  </Text>
                  {gym.address ? (
                    <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 12, color: colors.fog }}>
                      {gym.address}
                    </Text>
                  ) : null}
                </View>
                {distance ? (
                  <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10.5, color: colors.fog }}>{distance}</Text>
                ) : null}
              </Pressable>
            );
          })
        )}
        {gyms.hasNextPage ? (
          <Pressable
            accessibilityLabel="Load more gyms"
            onPress={() => void gyms.fetchNextPage()}
            haptic={false}
            style={{ alignItems: "center", paddingVertical: 12 }}
          >
            <Text style={{ fontFamily: "Geist_600SemiBold", fontSize: 12.5, color: colors.mist }}>
              {gyms.isFetchingNextPage ? "Loading…" : "Load more"}
            </Text>
          </Pressable>
        ) : null}
      </SheetScrollView>
    </View>
  );
}
