import { useEffect } from "react";
import { View } from "react-native";

import { Screen } from "@/components/Screen";
import { Text } from "@/components/ui/Text";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/auth";

/**
 * Age-gate hard block (§1). No account, no partial state, no explanation of the
 * threshold, no invitation to retry. Signs the provisional session out so no
 * usable account survives the attempt.
 */
export default function BlockedScreen() {
  useEffect(() => {
    void (async () => {
      try {
        await supabase.auth.signOut();
      } catch {
        // best-effort
      }
      useAuthStore.getState().signOut?.();
    })();
  }, []);

  return (
    <Screen>
      <View className="flex-1 items-center justify-center px-6">
        <Text variant="display-sm" className="text-center">
          ACCOUNT NOT AVAILABLE
        </Text>
        <Text variant="body" className="mt-4 text-center text-mist">
          We can&apos;t create an account for you right now.
        </Text>
      </View>
    </Screen>
  );
}
