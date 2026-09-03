import { Trash2 } from "lucide-react-native";
import { appAlert } from "@/components/ui/AppDialog";
import { useRef, type ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import ReanimatedSwipeable, { type SwipeableMethods } from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";

import { colors } from "@/theme/colors";
import { tokens } from "@/theme/tokens";

const ACTION_WIDTH = 84;

/** The red delete pane revealed behind the row (tracks the drag 1:1). */
function DeleteAction({ drag, onPress }: { drag: SharedValue<number>; onPress: () => void }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.value + ACTION_WIDTH }]
  }));
  return (
    <Animated.View style={[styles.action, style]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Delete conversation"
        style={styles.actionPress}
      >
        <Trash2 size={22} color={colors.pure} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Instagram-style swipe-left-to-delete wrapper for an inbox thread row.
 * Deleting is per-user (the other person keeps their copy) — the confirm
 * copy says so. Children render the normal ListRow.
 */
export function SwipeableThreadRow({
  name,
  onDelete,
  children
}: {
  /** Display name used in the confirm dialog. */
  name: string;
  onDelete: () => void;
  children: ReactNode;
}) {
  const swipeRef = useRef<SwipeableMethods>(null);

  const confirmDelete = () => {
    appAlert(
      "Delete conversation?",
      `It disappears from your inbox — ${name} keeps their copy. A new message starts fresh.`,
      [
        { text: "Cancel", style: "cancel", onPress: () => swipeRef.current?.close() },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            swipeRef.current?.close();
            onDelete();
          }
        }
      ]
    );
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      // Opaque row background so the red pane only shows where the row slid away.
      childrenContainerStyle={styles.row}
      renderRightActions={(_progress, drag) => <DeleteAction drag={drag} onPress={confirmDelete} />}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: colors.black
  },
  action: {
    width: ACTION_WIDTH,
    backgroundColor: tokens.status.danger
  },
  actionPress: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center"
  }
});
