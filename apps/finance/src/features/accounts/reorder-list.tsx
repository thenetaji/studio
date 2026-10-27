/* eslint-disable react-hooks/immutability -- shared values are written from gesture worklets */
import * as React from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

import { AppIcon } from "@studio/icons";
import { haptic, springs, useTokens } from "@studio/theme";

import { moveItem, orderBySlots, reslot, slotFor } from "./reorder";

type Slots = Record<string, number>;

type ReorderRowProps = {
  id: string;
  count: number;
  rowHeight: number;
  slots: SharedValue<Slots>;
  active: SharedValue<string | null>;
  onDrop: () => void;
  onDragChange?: (dragging: boolean) => void;
  renderRow: (handle: React.ReactNode) => React.ReactNode;
  onMove: (direction: -1 | 1) => void;
  label: string;
};

function ReorderRow({
  id,
  count,
  rowHeight,
  slots,
  active,
  onDrop,
  onDragChange,
  renderRow,
  onMove,
  label,
}: ReorderRowProps) {
  // Shared values are mutated from gesture worklets, which the React Compiler cannot model.
  "use no memo";
  const { colors } = useTokens();
  const y = useSharedValue(0);
  const start = useSharedValue(0);

  const pan = Gesture.Pan()
    .onBegin(() => {
      active.value = id;
      start.value = (slots.value[id] ?? 0) * rowHeight;
      y.value = start.value;
      runOnJS(haptic)("light");
      if (onDragChange) runOnJS(onDragChange)(true);
    })
    .onUpdate((event) => {
      y.value = Math.min(
        Math.max(start.value + event.translationY, 0),
        (count - 1) * rowHeight,
      );
      const slot = slotFor(0, y.value / 1, rowHeight, count);
      if (slot !== slots.value[id]) {
        slots.value = reslot(slots.value, id, slot);
        runOnJS(haptic)("selection");
      }
    })
    .onFinalize(() => {
      if (active.value === id) {
        active.value = null;
        runOnJS(onDrop)();
      }
      if (onDragChange) runOnJS(onDragChange)(false);
    });

  const style = useAnimatedStyle(() => {
    const dragging = active.value === id;
    const rest = (slots.value[id] ?? 0) * rowHeight;
    return {
      position: "absolute",
      left: 0,
      right: 0,
      height: rowHeight,
      top: dragging ? y.value : withSpring(rest, springs.layout),
      zIndex: dragging ? 10 : 0,
      opacity: dragging ? 0.96 : 1,
      transform: [{ scale: withSpring(dragging ? 1.02 : 1, springs.press) }],
    };
  });

  const handle = (
    <GestureDetector gesture={pan}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Reorder ${label}`}
        accessibilityActions={[
          { name: "increment", label: "Move down" },
          { name: "decrement", label: "Move up" },
        ]}
        onAccessibilityAction={(event) =>
          onMove(event.nativeEvent.actionName === "increment" ? 1 : -1)
        }
        className="h-11 w-11 items-center justify-center"
      >
        <AppIcon
          name="line.3.horizontal"
          size={18}
          color={colors.textTertiary}
        />
      </View>
    </GestureDetector>
  );

  return <Animated.View style={style}>{renderRow(handle)}</Animated.View>;
}

type ReorderListProps = {
  ids: readonly string[];
  rowHeight: number;
  labelOf: (id: string) => string;
  renderRow: (
    id: string,
    handle: React.ReactNode,
    isLast: boolean,
  ) => React.ReactNode;
  onReorder: (ids: string[]) => void;
  /** Called with true when a handle is touched and false when it is let go, so a parent ScrollView can stop scrolling meanwhile. */
  onDragChange?: (dragging: boolean) => void;
};

/** Drag-to-reorder on Reanimated + Gesture Handler: fixed-height rows, the dragged row follows the finger and others shift. */
function ReorderList({
  ids,
  rowHeight,
  labelOf,
  renderRow,
  onReorder,
  onDragChange,
}: ReorderListProps) {
  // Keyed by content, not identity: callers often pass a fresh array each render, and resetting the
  // slots on every render snapped rows back mid-drag.
  const order = ids.join("|");
  const initial = React.useMemo(
    () =>
      Object.fromEntries(
        (order ? order.split("|") : []).map((id, i) => [id, i]),
      ) as Slots,
    [order],
  );
  const slots = useSharedValue<Slots>(initial);
  const active = useSharedValue<string | null>(null);
  React.useEffect(() => {
    slots.value = initial;
  }, [initial, slots]);

  const drop = React.useCallback(() => {
    const next = orderBySlots(slots.value);
    if (next.join() !== ids.join()) onReorder(next);
  }, [slots, ids, onReorder]);

  return (
    <View style={{ height: ids.length * rowHeight }}>
      {ids.map((id, index) => (
        <ReorderRow
          key={id}
          id={id}
          count={ids.length}
          rowHeight={rowHeight}
          slots={slots}
          active={active}
          onDrop={drop}
          onDragChange={onDragChange}
          label={labelOf(id)}
          onMove={(direction) =>
            onReorder(moveItem(ids, index, index + direction))
          }
          renderRow={(handle) =>
            renderRow(id, handle, index === ids.length - 1)
          }
        />
      ))}
    </View>
  );
}

export { ReorderList };
