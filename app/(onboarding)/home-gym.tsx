import { FlashList } from "@shopify/flash-list";
import { useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";
import { router } from "expo-router";
import { MapPin } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { Pressable } from "@/components/ui/Pressable";
import { SearchBar } from "@/components/ui/SearchBar";
import { Text } from "@/components/ui/Text";
import {
  formatDistance,
  useGymSearch,
  type GymSearchCoords,
  type GymSearchResult
} from "@/hooks/queries/useGymSearch";
import { logger } from "@/lib/logger";
import { advanceOnboarding } from "@/lib/onboarding";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import { colors } from "@/theme/colors";

const SEARCH_DEBOUNCE_MS = 300;

/** ~11m precision — keeps the query key stable across tiny GPS jitters. */
function roundCoord(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

export default function HomeGymScreen() {
  const insets = useSafeAreaInsets();
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
      await advanceOnboarding(userId, "complete");
      router.replace("/feed");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ home_gym_id: selectedId, onboarding_stage: "complete" })
        .eq("id", userId);
      if (error) {
        throw error;
      }
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      useAuthStore.getState().setOnboardingStage("complete");
      router.replace("/feed");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save gym.";
      Alert.alert("Couldn't save", message);
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
    <View className="flex-1 bg-black px-4" style={{ paddingTop: insets.top + 16 }}>
      <View className="self-start rounded-pill border border-hairline-strong bg-glass-strong px-3 py-1">
        <Text variant="micro" className="text-mist">
          STEP 5 OF 5
        </Text>
      </View>
      <Text variant="display-md" className="mt-6">
        PICK YOUR GYM.
      </Text>
      <Text variant="italic" className="mt-3">
        {coords ? "Closest first. Yours should be near the top." : "A gym is a place, not a group."}
      </Text>

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
          renderItem={renderGym}
          extraData={selectedId}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 12 }}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={
            gyms.isLoading || !locationSettled ? (
              <View className="items-center pt-16">
                <ActivityIndicator color={colors.white} />
                <Text variant="caption" className="mt-4 text-mist">
                  {coords ? "Finding gyms near you…" : "Loading gyms…"}
                </Text>
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
                <Text variant="caption" className="text-mist">
                  {query ? `No gyms match "${query}".` : "No gyms yet."}
                </Text>
              </View>
            )
          }
          ListFooterComponent={
            gyms.isFetchingNextPage ? (
              <View className="items-center py-4">
                <ActivityIndicator color={colors.mist} size="small" />
              </View>
            ) : null
          }
        />
      </View>

      <View style={{ paddingBottom: insets.bottom + 12 }}>
        <Button className="mt-2" onPress={handleNext} loading={submitting} disabled={!selectedId}>
          Set home gym
        </Button>
        <Pressable
          className="mt-4 self-center"
          onPress={() => {
            void advanceOnboarding(userId, "complete");
            router.replace("/feed");
          }}
        >
          <Text variant="micro" className="text-mist">
            SKIP FOR NOW
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function GymCard({
  gym,
  selected,
  onPress
}: {
  gym: GymSearchResult;
  selected: boolean;
  onPress: () => void;
}) {
  const distance = formatDistance(gym.distance_meters);
  return (
    <Pressable
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
        <MapPin color={selected ? colors.black : colors.white} size={17} strokeWidth={1.8} />
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
