import { Component, type ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { logger } from "@/lib/logger";
import { colors } from "@/theme/colors";

type Props = { children: ReactNode; onClose: () => void };
type State = { failed: boolean };

/**
 * Catches any render/gesture crash inside the photo or video editor and shows
 * a friendly recovery screen instead of taking down the whole app. "Back"
 * returns to the preview with the unedited media intact.
 */
export class EditorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    logger.warn("editor_crashed", { message: error instanceof Error ? error.message : String(error) });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.black, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 }}>
        <Text style={{ fontFamily: "Geist_700Bold", fontSize: 18, color: colors.white, textAlign: "center" }}>
          Editing hit a snag
        </Text>
        <Text style={{ marginTop: 10, fontFamily: "Geist_400Regular", fontSize: 13.5, lineHeight: 20, color: colors.fog, textAlign: "center" }}>
          Something went wrong in the editor. Your photo is safe — you can post it as-is or try editing again.
        </Text>
        <View style={{ marginTop: 24, alignSelf: "stretch" }}>
          <Button onPress={this.props.onClose}>Back to preview</Button>
        </View>
      </View>
    );
  }
}
