import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import { GymRow } from "@/components/map/GymRow";
import { SearchBar } from "@/components/ui/SearchBar";
import { Text } from "@/components/ui/Text";
import { formatDistance, useGymSearch, type GymSearchCoords, type GymSearchResult } from "@/hooks/queries/useGymSearch";
import { colors } from "@/theme/colors";
import { radius, space, tokens } from "@/theme/tokens";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Gym search floated over the map: the same debounced, distance-sorted
 * `search_gyms` search the home-gym picker uses; picking a result hands the
 * gym back so the map can open it.
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

  const reset = () => {
    setFocused(false);
    setInput("");
    setQuery("");
  };

  return (
    <View style={{ position: "absolute", top: space[2] + 2, left: space[3], right: space[3], zIndex: 20 }}>
      <SearchBar
        value={input}
        onChangeText={setInput}
        onFocus={() => setFocused(true)}
        placeholder="Search gyms"
        // Opaque over the map so pins never bleed through the field.
        containerStyle={{ borderRadius: radius.pill, backgroundColor: colors.graphite }}
      />
      {open ? (
        <View
          style={{
            marginTop: space[2],
            maxHeight: 280,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: tokens.border.default,
            backgroundColor: colors.graphite,
            overflow: "hidden"
          }}
        >
          <ScrollView keyboardShouldPersistTaps="handled">
            {rows.length === 0 ? (
              <View style={{ padding: space[4], alignItems: "center" }}>
                <Text variant="meta" className="text-center">
                  {gyms.isLoading ? "Searching…" : `No gyms match "${query.trim()}".`}
                </Text>
              </View>
            ) : (
              rows.map((gym) => {
                const distance = formatDistance(gym.distance_meters);
                return (
                  <GymRow
                    key={gym.id}
                    gym={gym}
                    right={distance ? <Text variant="mono">{distance}</Text> : undefined}
                    onPress={() => {
                      reset();
                      onPick(gym);
                    }}
                  />
                );
              })
            )}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
