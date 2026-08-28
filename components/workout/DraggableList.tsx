import * as Haptics from "expo-haptics";
import { useCallback, useEffect, type ReactNode } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue
} from "react-native-reanimated";

/**
 * Settle spring — quick but not bouncy, so cards feel weighted.
 *
 * The rest thresholds matter: with Reanimated's defaults a spring trails
 * asymptotically for a few hundred ms after it looks finished, which delayed
 * the commit callback and read as lag on drop.
 */
const SPRING = {
  damping: 22,
  stiffness: 240,
  mass: 0.7,
  restDisplacementThreshold: 0.5,
  restSpeedThreshold: 2
} as const;

/** Y of the slot at `slot`, given the current order and measured heights. */
function slotY(slot: number, order: number[], heights: number[], gap: number): number {
  "worklet";
  let y = 0;
  for (let s = 0; s < slot; s += 1) {
    y += (heights[order[s]] ?? 0) + gap;
  }
  return y;
}

/** Y an item sits at in natural (unmoved) document flow. */
function naturalY(index: number, heights: number[], gap: number): number {
  "worklet";
  let y = 0;
  for (let i = 0; i < index; i += 1) {
    y += (heights[i] ?? 0) + gap;
  }
  return y;
}

type Props<T> = {
  data: T[];
  keyExtractor: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number) => ReactNode;
  /** Fires once the drag settles, with the reordered array. */
  onReorder: (next: T[]) => void;
  /** Lets the parent freeze its ScrollView while a card is in hand. */
  onDragActiveChange?: (active: boolean) => void;
  /** Vertical space between cards. */
  gap?: number;
  /** Hold duration before a card lifts. */
  holdMs?: number;
};

/**
 * Long-press-and-drag list reordering.
 *
 * Cards stay in normal document flow — dragging only applies a translateY
 * delta — so variable-height rows (an exercise with 1 set vs 5) need no
 * absolute positioning and the first paint is never wrong. The lifted card
 * tracks the finger 1:1 while its neighbours spring out of the way; on
 * release it springs into its slot and the new order commits.
 *
 * Haptics: medium tap on lift, selection tick each time the order changes,
 * light tap on drop.
 */
export function DraggableList<T>({
  data,
  keyExtractor,
  renderItem,
  onReorder,
  onDragActiveChange,
  gap = 12,
  holdMs = 180
}: Props<T>) {
  const heights = useSharedValue<number[]>([]);
  const order = useSharedValue<number[]>(data.map((_, i) => i));
  const active = useSharedValue(-1);
  const drag = useSharedValue(0);
  // Springs are for DRAGGING only. The commit swap (data reorders, offsets
  // return to zero) must be instant: the rows are already in their new
  // places, so animating that transition plays a second, wrong animation
  // on top of the settle. Re-armed when the next drag starts.
  const animate = useSharedValue(true);

  const keys = data.map(keyExtractor).join("|");
  // Data changed (added, removed, or a committed reorder) → identity order.
  useEffect(() => {
    // Positions are already correct once the data reorders — snap, don't spring.
    animate.value = false;
    order.value = data.map((_, i) => i);
    drag.value = 0;
    active.value = -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys]);

  const setHeight = useCallback(
    (index: number, h: number) => {
      const next = [...heights.value];
      if (next[index] === h) return;
      next[index] = h;
      heights.value = next;
    },
    [heights]
  );

  const commit = useCallback(
    (nextOrder: number[]) => {
      onDragActiveChange?.(false);
      // Only rebuild the array when something actually moved.
      const moved = nextOrder.some((dataIndex, slot) => dataIndex !== slot);
      if (moved) {
        onReorder(nextOrder.map((i) => data[i]));
      } else {
        // Dropped where it started — nothing to re-render, just reset.
        animate.value = false;
        order.value = data.map((_, i) => i);
        drag.value = 0;
        active.value = -1;
      }
    },
    [data, onReorder, onDragActiveChange, order, drag, active, animate]
  );

  const started = useCallback(() => {
    onDragActiveChange?.(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [onDragActiveChange]);

  const released = useCallback(() => {
    onDragActiveChange?.(false);
  }, [onDragActiveChange]);

  const tick = useCallback(() => {
    void Haptics.selectionAsync().catch(() => {});
  }, []);

  const dropped = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  return (
    <View>
      {data.map((item, index) => (
        <DragRow
          key={keyExtractor(item, index)}
          index={index}
          count={data.length}
          gap={gap}
          holdMs={holdMs}
          heights={heights}
          order={order}
          active={active}
          drag={drag}
          animate={animate}
          onMeasure={setHeight}
          onStart={started}
          onRelease={released}
          onTick={tick}
          onDrop={dropped}
          onCommit={commit}
        >
          {renderItem(item, index)}
        </DragRow>
      ))}
    </View>
  );
}

function DragRow({
  index,
  count,
  gap,
  holdMs,
  heights,
  order,
  active,
  drag,
  animate,
  onMeasure,
  onStart,
  onRelease,
  onTick,
  onDrop,
  onCommit,
  children
}: {
  index: number;
  count: number;
  gap: number;
  holdMs: number;
  heights: SharedValue<number[]>;
  order: SharedValue<number[]>;
  active: SharedValue<number>;
  drag: SharedValue<number>;
  animate: SharedValue<boolean>;
  onMeasure: (index: number, h: number) => void;
  onStart: () => void;
  onRelease: () => void;
  onTick: () => void;
  onDrop: () => void;
  onCommit: (order: number[]) => void;
  children: ReactNode;
}) {
  const pan = Gesture.Pan()
    // Hold first: a plain drag would fight the parent ScrollView, and taps on
    // the inputs inside the card must still work.
    .activateAfterLongPress(holdMs)
    .onStart(() => {
      animate.value = true;
      active.value = index;
      drag.value = 0;
      runOnJS(onStart)();
    })
    .onUpdate((e) => {
      drag.value = e.translationY;

      // Where the lifted card sits right now.
      const top = naturalY(index, heights.value, gap) + drag.value;
      const mine = order.value.indexOf(index);
      const h = heights.value[index] ?? 0;
      const centre = top + h / 2;

      // Which slot is that centre over? Dragging past either end clamps to
      // the first/last slot instead of doing nothing.
      let target = mine;
      const lastY = slotY(count - 1, order.value, heights.value, gap);
      if (centre <= 0) {
        target = 0;
      } else if (centre >= lastY) {
        target = count - 1;
      } else {
        for (let s = 0; s < count; s += 1) {
          const y = slotY(s, order.value, heights.value, gap);
          const sh = heights.value[order.value[s]] ?? 0;
          if (centre >= y && centre <= y + sh + gap) {
            target = s;
            break;
          }
        }
      }
      if (target !== mine) {
        const next = [...order.value];
        next.splice(mine, 1);
        next.splice(target, 0, index);
        order.value = next;
        runOnJS(onTick)();
      }
    })
    .onEnd(() => {
      // Spring the card into its slot, then commit the new order.
      const mine = order.value.indexOf(index);
      const rest = slotY(mine, order.value, heights.value, gap) - naturalY(index, heights.value, gap);
      const settled = order.value;
      drag.value = withSpring(rest, SPRING, (done) => {
        // Guard: if the card was grabbed again before this settled, the new
        // drag owns the state — don't reset it out from under itself.
        if (done && active.value === index) {
          active.value = -1;
          runOnJS(onCommit)(settled);
        }
      });
      runOnJS(onDrop)();
    })
    // A drag can end WITHOUT onEnd — the gesture gets cancelled (touch stolen
    // by a scroll, the screen navigating, a system interruption). onEnd was
    // the only path that unfroze the parent ScrollView, so a cancelled lift
    // left the workout screen unscrollable until you swiped out. Always
    // release here; on a cancel also snap the card home.
    .onFinalize((_e, success) => {
      if (!success) {
        animate.value = false;
        order.value = order.value.map((_v, i) => i);
        drag.value = 0;
        active.value = -1;
      }
      runOnJS(onRelease)();
    });

  const style = useAnimatedStyle(() => {
    const isActive = active.value === index;
    const mine = order.value.indexOf(index);
    const rest = slotY(mine, order.value, heights.value, gap) - naturalY(index, heights.value, gap);
    return {
      transform: [
        // Held card follows the finger; neighbours glide while dragging, but
        // the post-commit reset lands instantly (animate === false).
        { translateY: isActive ? drag.value : animate.value ? withSpring(rest, SPRING) : rest },
        { scale: withTiming(isActive ? 1.03 : 1, { duration: 140 }) }
      ],
      zIndex: isActive ? 20 : 0,
      elevation: isActive ? 12 : 0,
      shadowColor: "#000",
      shadowOpacity: withTiming(isActive ? 0.45 : 0, { duration: 140 }),
      shadowRadius: isActive ? 18 : 0,
      shadowOffset: { width: 0, height: isActive ? 10 : 0 }
    };
  });

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        onLayout={(e) => onMeasure(index, e.nativeEvent.layout.height)}
        style={[{ marginBottom: gap }, style]}
      >
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
