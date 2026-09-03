import { Dumbbell, Home, MapPin } from "lucide-react-native";
import { useState } from "react";
import { useWindowDimensions, View } from "react-native";
import { ScrollView as SheetScrollView } from "react-native-gesture-handler";

import { IconTile } from "@/components/camera/ComposeChrome";
import type { SelectedGym } from "@/components/camera/types";
import { ChoiceRow } from "@/components/ui/ChoiceRow";
import { SearchBar } from "@/components/ui/SearchBar";
import { Hairline } from "@/components/ui/SectionLabel";
import { SheetSub, SheetTitle } from "@/components/ui/Sheet";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { formatDistance, useGymSearch, type GymSearchCoords, type GymSearchResult } from "@/hooks/queries/useGymSearch";
import { colors } from "@/theme/colors";
import { icon, space } from "@/theme/tokens";

const glyph = (Icon: typeof Dumbbell) => (
  <IconTile round>
    <Icon size={icon.size.xs - 1} color={colors.mist} strokeWidth={icon.stroke.regular} />
  </IconTile>
);

/** "Where was this?" — mapped gym search plus the two unmapped options. */
export function GymSheet({
  selected,
  coords,
  locationSettled,
  onSelect
}: {
  selected: SelectedGym | null;
  coords: GymSearchCoords | null;
  locationSettled: boolean;
  onSelect: (gym: SelectedGym) => void;
}) {
  const [query, setQuery] = useState("");
  const { height: windowHeight } = useWindowDimensions();
  const listHeight = Math.min(300, Math.round(windowHeight * 0.32));
  const gyms = useGymSearch(query, coords, locationSettled);
  const rows: GymSearchResult[] = (gyms.data?.pages?.[0] ?? []).slice(0, 20);

  return (
    <View>
      <SheetTitle>Where was this?</SheetTitle>
      <SheetSub>
        Mapped gyms show on the post. Custom locations and unlisted spots won&apos;t claim a mapped gym.
      </SheetSub>
      <View style={{ paddingHorizontal: space[4] + 4, paddingBottom: space[2] }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search gyms" />
      </View>
      {/* Fixed-height results area: the sheet is dynamically sized, so without
          this it shrinks as search narrows the list and slides under the
          keyboard. Results scroll inside instead. */}
      <View style={{ height: listHeight }}>
        {gyms.isLoading || !locationSettled ? (
          <View style={{ paddingTop: space[1] + 2 }}>
            <SkeletonRow avatar={0} />
            <SkeletonRow avatar={0} />
            <SkeletonRow avatar={0} />
            <SkeletonRow avatar={0} />
          </View>
        ) : rows.length === 0 ? (
          <Text variant="meta" className="pt-7 text-center">
            No gyms found. Try a different name.
          </Text>
        ) : (
          <SheetScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {rows.map((gym) => {
              const distance = formatDistance(gym.distance_meters);
              return (
                <ChoiceRow
                  key={gym.id}
                  title={gym.name}
                  sub={[gym.address, distance].filter(Boolean).join(" · ") || "Mapped gym"}
                  selected={selected?.type === "gym" && selected.id === gym.id}
                  left={glyph(Dumbbell)}
                  onPress={() => onSelect({ type: "gym", id: gym.id, name: gym.name })}
                />
              );
            })}
          </SheetScrollView>
        )}
      </View>
      <Hairline style={{ marginVertical: space[1] + 2, marginHorizontal: space[4] + 4 }} />
      <ChoiceRow
        title="Custom location"
        sub="Home gym or another spot that isn't mapped"
        selected={selected?.type === "home"}
        left={glyph(Home)}
        onPress={() => onSelect({ type: "home" })}
      />
      <ChoiceRow
        title="Other / unlisted"
        sub="Not a mapped gym"
        selected={selected?.type === "other"}
        left={glyph(MapPin)}
        onPress={() => onSelect({ type: "other" })}
      />
    </View>
  );
}
