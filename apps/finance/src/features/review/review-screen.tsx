import { useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import {
  ScrollView,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { HeaderButton, Pressable } from "@studio/ui";
import { useSettings, useTodayKey, useYearReview } from "@/data/hooks";
import { parseKey } from "@studio/dates";
import { haptic, useTokens, withAlpha } from "@studio/theme";
import { useReportMoney } from "@/features/report/money";

import { ReviewCard, reviewCards, type ReviewCardKind } from "./cards";

const BAR_HEIGHT = 3;

function Segment({ state }: { state: "done" | "active" | "todo" }) {
  const { colors } = useTokens();
  const reduced = useReducedMotion();
  const fill = useSharedValue(state === "todo" ? 0 : 1);
  React.useEffect(() => {
    const target = state === "todo" ? 0 : 1;
    fill.value = reduced ? target : withTiming(target, { duration: 260 });
  }, [state, fill, reduced]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View
      style={{
        flex: 1,
        height: BAR_HEIGHT,
        borderRadius: BAR_HEIGHT / 2,
        overflow: "hidden",
        backgroundColor: withAlpha(colors.text, 0.16),
      }}
    >
      <Animated.View
        style={[
          { height: BAR_HEIGHT, backgroundColor: withAlpha(colors.text, 0.85) },
          style,
        ]}
      />
    </View>
  );
}

/** `/review/[year]?card=n`: year in review as full-screen paged cards. Tap the right two thirds or swipe to advance. */
export default function ReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ year?: string; card?: string }>();
  const today = useTodayKey();
  const settings = useSettings();
  const thisYear = parseKey(today).year;
  const parsed = Number.parseInt(params.year ?? "", 10);
  const year =
    Number.isFinite(parsed) && parsed > 1900 && parsed <= thisYear
      ? parsed
      : thisYear;
  const review = useYearReview(year, today);
  const money = useReportMoney(review.currency);
  const cards = React.useMemo(() => reviewCards(review), [review]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = React.useRef<ScrollView>(null);
  // `?card=` takes an index or a card name (deep links and screenshots).
  const named = cards.indexOf(params.card as ReviewCardKind);
  const initial = Math.min(
    Math.max(
      0,
      named >= 0 ? named : Number.parseInt(params.card ?? "0", 10) || 0,
    ),
    cards.length - 1,
  );
  const [index, setIndex] = React.useState(initial);
  // Cards mount on first visit so their entrance plays when reached, and stay mounted after.
  const [seen, setSeen] = React.useState(() => new Set([initial]));
  const go = React.useCallback(
    (next: number, animated = true) => {
      const clamped = Math.min(Math.max(next, 0), cards.length - 1);
      scroller.current?.scrollTo({ x: clamped * width, animated });
      setIndex(clamped);
      setSeen((s) => (s.has(clamped) ? s : new Set([...s, clamped])));
    },
    [cards.length, width],
  );
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
    if (next !== index) {
      haptic("selection");
      setIndex(next);
      setSeen((s) => (s.has(next) ? s : new Set([...s, next])));
    }
  };
  const kind: ReviewCardKind = cards[index] ?? "intro";
  const top = insets.top + 64;
  const bottom = insets.bottom + 32;

  return (
    <View className="flex-1 bg-bg">
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onEnd}
        contentOffset={{ x: initial * width, y: 0 }}
        onLayout={() => {
          // Web ignores contentOffset; jump once the pager is laid out (deep links with ?card=).
          if (initial > 0)
            scroller.current?.scrollTo({ x: initial * width, animated: false });
        }}
        bounces={false}
      >
        {cards.map((card, i) => (
          <View key={card} style={{ width, height }}>
            {seen.has(i) ? (
              <ReviewCard
                kind={card}
                review={review}
                money={money}
                today={today}
                weekStart={settings.week_start}
                still={false}
                insets={{ top, bottom }}
              />
            ) : null}
            <View
              style={{
                position: "absolute",
                top,
                bottom: 0,
                left: 0,
                right: 0,
                flexDirection: "row",
              }}
            >
              <Pressable
                role="button"
                accessibilityLabel="Previous card"
                scale={1}
                disabled={i === 0}
                onPress={() => go(i - 1)}
                style={{ width: "30%" }}
              />
              <Pressable
                role="button"
                accessibilityLabel="Next card"
                scale={1}
                disabled={i === cards.length - 1}
                onPress={() => {
                  haptic("selection");
                  go(i + 1);
                }}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        ))}
      </ScrollView>
      <View
        pointerEvents="box-none"
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 0,
          right: 0,
          paddingHorizontal: 16,
        }}
      >
        <View
          className="flex-row gap-1"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={`Card ${index + 1} of ${cards.length}`}
        >
          {cards.map((card, i) => (
            <Segment
              key={card}
              state={i < index ? "done" : i === index ? "active" : "todo"}
            />
          ))}
        </View>
        <View
          className="mt-2 flex-row items-center justify-end"
          pointerEvents="box-none"
        >
          {review.entries > 0 ? (
            <HeaderButton
              symbol="square.and.arrow.up"
              label="Share"
              onPress={() =>
                router.push({
                  pathname: "/share-image",
                  params: { kind: "year", ref: String(year), card: kind },
                })
              }
            />
          ) : null}
          <HeaderButton
            symbol="xmark"
            label="Close"
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace("/")
            }
          />
        </View>
      </View>
    </View>
  );
}
