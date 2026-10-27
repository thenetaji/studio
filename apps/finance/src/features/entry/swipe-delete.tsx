import * as React from "react";
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from "react-native-gesture-handler/ReanimatedSwipeable";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

import { AppIcon } from "@studio/icons";
import { Pressable, Text } from "@studio/ui";
import { haptic, useTokens } from "@studio/theme";

const ACTION_WIDTH = 72;
const FULL_SWIPE = 200;
const tick = () => haptic("selection");

function DeleteAction({
  translation,
  onFull,
  label,
}: {
  translation: SharedValue<number>;
  onFull: () => void;
  label: string;
}) {
  const { colors } = useTokens();
  useAnimatedReaction(
    () => translation.value,
    (value, previous) => {
      if (value < -FULL_SWIPE && (previous ?? 0) >= -FULL_SWIPE)
        runOnJS(onFull)();
      // Light tick the moment the action is fully revealed.
      else if (value < -ACTION_WIDTH && (previous ?? 0) >= -ACTION_WIDTH)
        runOnJS(tick)();
    },
  );
  const iconStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      -translation.value,
      [0, ACTION_WIDTH * 0.5],
      [0, 1],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scale: interpolate(
          -translation.value,
          [0, ACTION_WIDTH, FULL_SWIPE],
          [0.4, 1, 1.25],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));
  const style = useAnimatedStyle(() => ({
    width: Math.max(ACTION_WIDTH, -translation.value),
  }));
  return (
    <Pressable
      role="button"
      accessibilityLabel={label}
      scale={1}
      onPress={onFull}
      className="flex-row justify-end"
      style={{ width: ACTION_WIDTH }}
    >
      <Animated.View
        style={[
          { backgroundColor: colors.expense, minWidth: ACTION_WIDTH },
          style,
        ]}
        className="items-center justify-center gap-1"
      >
        <Animated.View style={iconStyle}>
          <AppIcon name="trash.fill" size={18} color="#FFFFFF" />
        </Animated.View>
        <Text variant="caption" className="text-white">
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

type SwipeGroupValue = {
  /** A swipe started or ended now (its touch-up must not count as a tap). */
  swiped: () => void;
  /** `row` opened: close the row that was open before. */
  opened: (row: SwipeableMethods | null) => void;
  closed: (row: SwipeableMethods | null) => void;
  /** True when a press must be ignored; closes the open row if there is one. */
  guard: () => boolean;
};

const SwipeGroupContext = React.createContext<SwipeGroupValue | null>(null);

/** A tap within this long after a swipe ends is the swipe's own touch-up, not a tap. */
const SWIPE_TAP_GUARD_MS = 350;

/** Rows inside share one open row (like iOS Mail): opening a row closes the others. Pair with `useSwipeGuard`. */
function SwipeGroup({ children }: { children: React.ReactNode }) {
  const open = React.useRef<SwipeableMethods | null>(null);
  const lastSwipeAt = React.useRef(0);
  const value = React.useMemo<SwipeGroupValue>(
    () => ({
      swiped: () => {
        lastSwipeAt.current = Date.now();
      },
      opened: (row) => {
        lastSwipeAt.current = Date.now();
        if (open.current && open.current !== row) open.current.close();
        open.current = row;
      },
      closed: (row) => {
        if (open.current === row) open.current = null;
      },
      guard: () => {
        if (Date.now() - lastSwipeAt.current < SWIPE_TAP_GUARD_MS) return true;
        if (open.current) {
          open.current.close();
          open.current = null;
          return true;
        }
        return false;
      },
    }),
    [],
  );
  return (
    <SwipeGroupContext.Provider value={value}>
      {children}
    </SwipeGroupContext.Provider>
  );
}

/**
 * Call at the top of a row's onPress inside a `SwipeGroup`. Returns true when the press must be ignored:
 * it is the touch-up of a swipe, or another row is open (that row is closed instead, as on iOS).
 */
function useSwipeGuard(): () => boolean {
  const group = React.useContext(SwipeGroupContext);
  return group ? group.guard : noGuard;
}

const noGuard = () => false;

type SwipeDeleteProps = {
  onDelete: () => void;
  label?: string;
  children: React.ReactNode;
};

/** Swipe left to reveal Delete; a full swipe deletes with a medium haptic. */
function SwipeDelete({
  onDelete,
  label = "Delete",
  children,
}: SwipeDeleteProps) {
  const ref = React.useRef<SwipeableMethods>(null);
  const group = React.useContext(SwipeGroupContext);
  const swiped = () => group?.swiped();
  const opened = () => group?.opened(ref.current);
  const closed = () => group?.closed(ref.current);
  const full = React.useCallback(() => {
    haptic("medium");
    ref.current?.close();
    onDelete();
  }, [onDelete]);
  return (
    <ReanimatedSwipeable
      ref={ref}
      friction={1.6}
      rightThreshold={ACTION_WIDTH / 2}
      onSwipeableOpenStartDrag={swiped}
      onSwipeableCloseStartDrag={swiped}
      onSwipeableWillOpen={opened}
      onSwipeableWillClose={swiped}
      onSwipeableClose={closed}
      renderRightActions={(_progress, translation) => (
        <DeleteAction translation={translation} onFull={full} label={label} />
      )}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

export { SwipeDelete, SwipeGroup, useSwipeGuard };
