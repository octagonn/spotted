import { MapPin, Search, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, ScrollView, Text, TextInput, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { formatDistance, useGymSearch, type GymSearchCoords, type GymSearchResult } from "@/hooks/queries/useGymSearch";
import { colors } from "@/theme/colors";
import { radius } from "@/theme/tokens";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Gym search over the map.
 *
 * The map tab had no way to find a gym by name — you had to pan and hope, or
 * zoom in far enough for pins to appear. This is the same debounced,
 * distance-sorted `search_gyms` search the home-gym picker uses, floated over
 * the canvas; picking a result hands the gym back so the map can open it.
 */
export function GymSearchBar({
  coords,
  onPick
}: {
  coords: GymSearchCoords | null;
  onPick: (gym: GymSearchResult) => void;
}) {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQuery(input), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [input]);

  const gyms = useGymSearch(query, coords, true);
  const rows = (gyms.data?.pages ?? []).flat();
  const open = focused && query.trim().length > 0;

  return (
    <View style={{ position: "absolute", top: 10, left: 12, right: 12, zIndex: 20 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
          paddingHorizontal: 14,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: colors.iron,
          backgroundColor: "rgba(20,20,22,0.96)"
        }}
      >
        <Search size={16} color={colors.fog} strokeWidth={2} />
        <TextInput
          value={input}
          onChangeText={setInput}
          onFocus={() => setFocused(true)}
          accessibilityLabel="Search gyms"
          placeholder="Search gyms"
          placeholderTextColor={colors.fog}
          autoCorrect={false}
          returnKeyType="search"
          style={{ flex: 1, fontSize: 15, color: colors.white, paddingVertical: Platform.OS === "ios" ? 10 : 6 }}
        />
        {input.length > 0 ? (
          <Pressable
            onPress={() => {
              setInput("");
              setQuery("");
            }}
            accessibilityLabel="Clear search"
            hitSlop={8}
            haptic={false}
          >
            <X size={16} color={colors.fog} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>

      {open ? (
        <View
          style={{
            marginTop: 8,
            maxHeight: 280,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.iron,
            backgroundColor: "rgba(20,20,22,0.98)",
            overflow: "hidden"
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {rows.length === 0 ? (
              <Text style={{ padding: 16, textAlign: "center", fontSize: 12.5, color: colors.fog }}>
                {gyms.isLoading ? "Searching…" : `No gyms match "${query.trim()}".`}
              </Text>
            ) : (
              rows.map((gym) => {
                const distance = formatDistance(gym.distance_meters);
                return (
                  <Pressable
                    key={gym.id}
                    onPress={() => {
                      setFocused(false);
                      setInput("");
                      setQuery("");
                      onPick(gym);
                    }}
                    accessibilityLabel={gym.name}
                    haptic={false}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: 14 }}>
                      <MapPin size={15} color={colors.mist} strokeWidth={2} />
                      <View style={{ flex: 1 }}>
                        <Text numberOfLines={1} style={{ fontFamily: "Geist_600SemiBold", fontSize: 14, color: colors.white }}>
                          {gym.name}
                        </Text>
                        {gym.address ? (
                          <Text numberOfLines={1} style={{ marginTop: 1, fontSize: 11.5, color: colors.fog }}>
                            {gym.address}
                          </Text>
                        ) : null}
                      </View>
                      {distance ? (
                        <Text style={{ fontFamily: "GeistMono_400Regular", fontSize: 10, color: colors.fog }}>{distance}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
