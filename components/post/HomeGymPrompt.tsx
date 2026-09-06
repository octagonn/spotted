import AsyncStorage from "@react-native-async-storage/async-storage";
import { MapPin, X } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { HomeGymSheet } from "@/components/profile/HomeGymSheet";
import { Pressable } from "@/components/ui/Pressable";
import { useSheet } from "@/components/ui/Sheet";
import { Text } from "@/components/ui/Text";
import { useMyProfile } from "@/hooks/queries/useProfile";
import { useSetHomeGym } from "@/hooks/queries/useProfileExtras";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { showToast } from "@/stores/ui";
import { icon, radius, space, tokens } from "@/theme/tokens";

/** AsyncStorage flag: "Not now" was tapped — never show the card again. */
const DISMISSED_KEY = "spotted:homeGymPromptDismissed";

/**
 * One-time "set your home gym" card in the feed header. A home gym is what
 * makes the gym pill on posts, gym communities and (later) the leaderboard
 * work, and most accounts never open Edit profile to set one. Shown only when
 * the profile has loaded without a home gym and the card was never dismissed;
 * picking a gym or tapping "Not now" both retire it.
 */
export function HomeGymPrompt() {
  const sheet = useSheet();
  const profile = useMyProfile();
  const setHomeGym = useSetHomeGym();
  // null = flag not read yet (render nothing rather than flash the card).
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((value) => {
        if (!cancelled) setDismissed(value === "1");
      })
      .catch(() => {
        if (!cancelled) setDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    trackAnalyticsEvent("home_gym_prompt_dismissed", {});
    AsyncStorage.setItem(DISMISSED_KEY, "1").catch((error) => {
      logger.warn("home_gym_prompt_persist_failed", {
        message: error instanceof Error ? error.message : String(error)
      });
    });
  };

  if (dismissed !== false) return null;
  if (!profile.data || profile.data.home_gym_id) return null;

  const pick = () => {
    sheet.open(
      <HomeGymSheet
        hasCurrent={false}
        onSelect={(gym) => {
          setHomeGym.mutate(gym.id, {
            onSuccess: () => {
              trackAnalyticsEvent("home_gym_prompt_set", {});
              showToast(`Home gym set to ${gym.name}`);
            }
          });
        }}
        onRemove={() => undefined}
        onClose={sheet.close}
      />
    );
  };

  return (
    <View
      style={{
        marginHorizontal: space[4],
        marginTop: space[2],
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
        paddingVertical: space[3],
        paddingLeft: space[4],
        paddingRight: space[2],
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: tokens.border.default,
        backgroundColor: tokens.bg.raised
      }}
    >
      <MapPin size={icon.size.md} color={tokens.text.primary} strokeWidth={icon.stroke.regular} />
      <Pressable
        haptic="selection"
        onPress={pick}
        accessibilityRole="button"
        accessibilityLabel="Set your home gym"
        style={{ flex: 1 }}
      >
        <Text variant="label" className="text-white">
          Set your home gym
        </Text>
        <Text variant="meta" numberOfLines={2}>
          Shows on your posts and puts you in your gym&apos;s crew.
        </Text>
      </Pressable>
      <Pressable
        haptic="none"
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Not now"
        hitSlop={8}
        style={{ padding: space[2] }}
      >
        <X size={icon.size.sm} color={tokens.text.tertiary} strokeWidth={icon.stroke.regular} />
      </Pressable>
    </View>
  );
}
