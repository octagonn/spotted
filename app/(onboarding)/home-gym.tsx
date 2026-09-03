import { FlashList } from "@shopify/flash-list";
import { appAlert } from "@/components/ui/AppDialog";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { router } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { OnboardingHeader } from "@/components/auth/OnboardingHeader";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { SkeletonRow } from "@/components/ui/Skeleton";
import { Text } from "@/components/ui/Text";
import { formatDistance, useGymSearch, type GymSearchCoords, type GymSearchResult } from "@/hooks/queries/useGymSearch";
import { usePageFade } from "@/hooks/usePageFade";
import { seedGymsNear } from "@/lib/gymSeeding";
import { logger } from "@/lib/logger";
import { advanceOnboarding } from "@/lib/onboarding";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";
import { icon } from "@/theme/tokens";

const SEARCH_DEBOUNCE_MS = 300;

/** ~11m precision — keeps the query key stable across tiny GPS jitters. */
function roundCoord(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export default function HomeGymScreen() {
  const insets = useSafeAreaInsets();
  const { fadeStyle, fadeNavigate } = usePageFade();
  const userId = useAuthStore((state) => state.userId);
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [coords, setCoords] = useState<GymSearchCoords | null>(null);
  const [locationSettled, setLocationSettled] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Grab the device location once (permission was requested on the previous
  // step). Never blocks the screen: on denial/failure gyms sort alphabetically.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted) {
          return;
        }
        const position =
          (await Location.getLastKnownPositionAsync()) ??
          (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
        if (!cancelled && position) {
          setCoords({
            latitude: roundCoord(position.coords.latitude),
            longitude: roundCoord(position.coords.longitude)
          });
        }
      } catch (error) {
        logger.warn("home_gym_location_failed", {
          message: error instanceof Error ? error.message : String(error)
        });
      } finally {
        if (!cancelled) {
          setLocationSettled(true);
        }
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
  const rows = useMemo(() => (gyms.data?.pages ?? []).flat(), [gyms.data]);

  // The gyms table only covers pre-seeded areas. This step is a hard gate, so
  // an empty nearby list would lock the user out of the app entirely — seed
  // their area live (Foursquare/OSM) once and re-run the search.
  const [seedState, setSeedState] = useState<"idle" | "seeding" | "done">("idle");
  const refetchGyms = gyms.refetch;
  useEffect(() => {
    if (seedState !== "idle" || !locationSettled || !coords) return;
    if (gyms.isLoading || gyms.isError) return;
    if (rows.length > 0) {
      setSeedState("done");
      return;
    }
    setSeedState("seeding");
    void seedGymsNear(coords.latitude, coords.longitude).then((seeded) => {
      setSeedState("done");
      if (seeded) void refetchGyms();
    });
  }, [seedState, locationSettled, coords, gyms.isLoading, gyms.isError, rows.length, refetchGyms]);

  const loadMore = useCallback(() => {
    if (gyms.hasNextPage && !gyms.isFetchingNextPage) {
      void gyms.fetchNextPage();
    }
  }, [gyms]);

  async function handleNext() {
    if (!selectedId) {
      return;
    }
    if (!isSupabaseConfigured || !userId) {
      await advanceOnboarding(userId, "friends");
      fadeNavigate(() => router.replace("/add-friends"));
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ home_gym_id: selectedId, onboarding_stage: "friends" })
        .eq("id", userId);
      if (error) {
        throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      useAuthStore.getState().setOnboardingStage("friends");
      fadeNavigate(() => router.replace("/add-friends"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save gym.";
      appAlert("Couldn't save", message);
    } finally {
      setSubmitting(false);
    }
  }

  const renderGym = useCallback(
    ({ item }: { item: GymSearchResult }) => (
      <GymCard gym={item} selected={selectedId === item.id} onPress={() => setSelectedId(item.id)} />
    ),
    [selectedId]
  );

  return (
    <Animated.View className="flex-1 px-4" style={[{ paddingTop: insets.top + 16 }, fadeStyle]}>
      <OnboardingHeader
        step={7}
        title="PICK YOUR GYM."
        body={`${coords ? "Closest first. " : ""}Check-ins need a home gym — pick yours to continue.`}
      />

      <SearchBar
        value={searchInput}
        onChangeText={setSearchInput}
        placeholder="Search for your gym"
        containerStyle={{ marginTop: 24, borderRadius: 999 }}
      />

      <View className="mt-4 flex-1">
        <FlashList
          data={rows}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          renderItem={renderGym}
          extraData={selectedId}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 12 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={
            gyms.isLoading || !locationSettled || seedState === "seeding" ? (
              <View className="pt-2">
                <SkeletonRow avatar={0} />
                <SkeletonRow avatar={0} />
                <SkeletonRow avatar={0} />
                <SkeletonRow avatar={0} />
                {seedState === "seeding" ? (
                  <Text variant="caption" className="pt-4 text-center text-mist">
                    Finding gyms near you…
                  </Text>
                ) : null}
              </View>
            ) : gyms.isError ? (
              <View className="items-center pt-16">
                <Text variant="caption" className="text-mist">
                  Couldn't load gyms. Check your connection.
                </Text>
                <Pressable className="mt-4" onPress={() => void gyms.refetch()}>
                  <Text variant="micro" className="text-white">
                    TRY AGAIN
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="items-center pt-16">
                <Text variant="caption" className="text-center text-mist">
                  {query ? `No gyms match "${query}". Try the name on the sign out front.` : "No gyms found nearby yet — try searching your gym's name."}
                </Text>
              </View>
            )
          }
          ListFooterComponent={gyms.isFetchingNextPage ? <SkeletonRow avatar={0} /> : null}
        />
      </View>

      {/* No skip: check-ins can't happen without a home gym, so this step is a
          hard gate — 45% skipped it and none of them ever checked in. */}
      <View style={{ paddingBottom: insets.bottom + 12 }}>
        <Button className="mt-2" onPress={handleNext} loading={submitting} disabled={!selectedId}>
          Set home gym
        </Button>
      </View>
    </Animated.View>
  );
}

function GymCard({ gym, selected, onPress }: { gym: GymSearchResult; selected: boolean; onPress: () => void }) {
  const distance = formatDistance(gym.distance_meters);
  return (
    <Pressable
      accessibilityLabel={gym.name}
      accessibilityState={{ selected }}
      className={`flex-row items-center gap-3 rounded-card border p-4 ${
        selected ? "border-white bg-white" : "border-hairline-strong bg-glass-strong"
      }`}
      onPress={onPress}
    >
      <View
        className={`h-10 w-10 items-center justify-center rounded-full border ${
          selected ? "border-black/15 bg-black/5" : "border-hairline bg-glass-soft"
        }`}
      >
        <MapPin color={selected ? colors.black : colors.white} size={icon.size.xs + 1} strokeWidth={icon.stroke.thin} />
      </View>
      <View className="flex-1">
        <Text variant="body-strong" numberOfLines={1} className={selected ? "text-black" : "text-white"}>
          {gym.name}
        </Text>
        {gym.address ? (
          <Text variant="caption" numberOfLines={1} className={`mt-1 ${selected ? "text-black/60" : "text-mist"}`}>
            {gym.address}
          </Text>
        ) : null}
      </View>
      {distance ? (
        <Text variant="micro" className={selected ? "text-black/70" : "text-mist"}>
          {distance}
        </Text>
      ) : null}
    </Pressable>
  );
}
