import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { BackButton } from "@/components/ui/BackButton";
import { Chip } from "@/components/ui/Chip";
import { Pressable } from "@/components/ui/Pressable";
import { Text } from "@/components/ui/Text";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";
import type { Database } from "@/types/database";

type ScheduleVisibility = Database["public"]["Enums"]["schedule_visibility"];

type PrivacySettings = {
  ghost_mode: boolean;
  discoverable: boolean;
  schedule_visibility: ScheduleVisibility;
  arrival_notifs_enabled: boolean;
};

const defaultSettings: PrivacySettings = {
  ghost_mode: false,
  discoverable: true,
  schedule_visibility: "friends",
  arrival_notifs_enabled: true
};

const visibilityOptions: ScheduleVisibility[] = ["public", "friends", "private"];

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      className={`h-7 w-12 justify-center rounded-pill border px-1 ${
        value ? "border-white bg-white" : "border-hairline-strong bg-glass"
      }`}
      onPress={onToggle}
    >
      <View
        className={`h-5 w-5 rounded-full ${value ? "self-end bg-black" : "self-start bg-mist"}`}
      />
    </Pressable>
  );
}

export default function PrivacySettingsScreen() {
  const userId = useAuthStore((state) => state.userId);
  const queryClient = useQueryClient();
  const queryKey = ["privacy-settings", userId];

  const settingsQuery = useQuery({
    queryKey,
    enabled: Boolean(userId),
    queryFn: async (): Promise<PrivacySettings> => {
      if (!isSupabaseConfigured) {
        return defaultSettings;
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("ghost_mode, discoverable, schedule_visibility, arrival_notifs_enabled")
        .eq("id", userId as string)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data ?? defaultSettings;
    }
  });

  const updateSettings = useMutation({
    mutationFn: async (patch: Partial<PrivacySettings>) => {
      if (!isSupabaseConfigured || !userId) {
        return;
      }
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) {
        throw error;
      }
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<PrivacySettings>(queryKey);
      queryClient.setQueryData<PrivacySettings>(queryKey, (current) => ({
        ...(current ?? defaultSettings),
        ...patch
      }));
      return { previous };
    },
    onError: (_error, _patch, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      if (isSupabaseConfigured) {
        void queryClient.invalidateQueries({ queryKey });
      }
    }
  });

  const settings = settingsQuery.data ?? defaultSettings;

  function toggle(key: "ghost_mode" | "discoverable" | "arrival_notifs_enabled") {
    updateSettings.mutate({ [key]: !settings[key] });
  }

  return (
    <Screen>
      <BackButton fallback="/settings" style={{ marginBottom: 18 }} />
      <Text variant="display-sm">PRIVACY</Text>
      <View className="mt-8 gap-3">
        <View className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <View className="flex-1 pr-4">
            <Text variant="body-strong">Ghost mode</Text>
            <Text variant="caption" className="mt-2">
              Hide your avatar from the gym map.
            </Text>
          </View>
          <Toggle value={settings.ghost_mode} onToggle={() => toggle("ghost_mode")} />
        </View>

        <View className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <View className="flex-1 pr-4">
            <Text variant="body-strong">Discoverable</Text>
            <Text variant="caption" className="mt-2">
              Let people at your gym find you.
            </Text>
          </View>
          <Toggle value={settings.discoverable} onToggle={() => toggle("discoverable")} />
        </View>

        <View className="border border-hairline-strong bg-ink p-4">
          <Text variant="body-strong">Schedule visibility</Text>
          <Text variant="caption" className="mt-2">
            Friends by default. Public if you mean it.
          </Text>
          <View className="mt-4 flex-row gap-2">
            {visibilityOptions.map((option) => (
              <Chip
                key={option}
                selected={settings.schedule_visibility === option}
                onPress={() => updateSettings.mutate({ schedule_visibility: option })}
              >
                {option.toUpperCase()}
              </Chip>
            ))}
          </View>
        </View>

        <View className="flex-row items-center border border-hairline-strong bg-ink p-4">
          <View className="flex-1 pr-4">
            <Text variant="body-strong">Arrival notifications</Text>
            <Text variant="caption" className="mt-2">
              Tell friends when you get to the gym.
            </Text>
          </View>
          <Toggle
            value={settings.arrival_notifs_enabled}
            onToggle={() => toggle("arrival_notifs_enabled")}
          />
        </View>
      </View>
    </Screen>
  );
}
