import { Text, View } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Rendered INSTEAD of the app when a release bundle shipped without backend
 * config (`isBrokenRelease`). Nothing else mounts: no router, no stores, no
 * query cache — so there is no code path left that could render fixture
 * people or the mock "Octavio" profile. The self-heal update check in
 * app/_layout.tsx still runs above this screen and swaps in the next good
 * bundle on the following foreground.
 */
export function ConfigBlocker() {
  return (
    <View
      className="flex-1 items-center justify-center px-8"
      style={{ backgroundColor: colors.black }}
      accessibilityRole="alert"
    >
      <Text
        style={{ color: colors.bone, fontFamily: "Boldonse_400Regular", fontSize: 22, textAlign: "center" }}
      >
        Spotted needs an update
      </Text>
      <Text
        style={{ color: colors.bone, opacity: 0.7, fontFamily: "Geist_400Regular", marginTop: 12, textAlign: "center" }}
      >
        This build can’t reach the server. Close the app fully and reopen it — a fix is downloading in the
        background.
      </Text>
    </View>
  );
}
