import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import * as React from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";

import { Button, ListGroup, ListRow, showToast, barLeft } from "@studio/ui";
import {
  useMonthReport,
  useSetting,
  useSettings,
  useTodayKey,
  useYearReview,
} from "@/data/hooks";
import { parseKey, periodLabel, type PeriodSettings } from "@studio/dates";
import { maskLocale } from "@studio/money";
import { haptic } from "@studio/theme";
import { useMoneyContext } from "@/features/transactions/use-money-context";
import { reportPeriod } from "@/features/report/labels";
import { makeReportMoney } from "@/features/report/money";
import {
  ReviewCard,
  reviewCards,
  type ReviewCardKind,
} from "@/features/review/cards";

import { shareViewAsImage } from "./capture";
import { MonthShareCard } from "./month-share-card";
import { ShareFrame } from "./share-frame";

const MONTH_RATIO = 8 / 5;
const STORY_RATIO = 16 / 9;
const MAX_WIDTH = 340;

type Params = { kind?: string; ref?: string; card?: string; hidden?: string };

/**
 * `/share-image?kind=month&ref=YYYY-MM` or `?kind=year&ref=YYYY&card=<kind>`: a preview of the image, a Hide amounts
 * switch (starts from the app-wide setting) and Share. The preview itself is what gets captured.
 */
export default function ShareImageScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const [globalHidden] = useSetting("hide_amounts");
  // `?hidden=1` starts with amounts hidden (screenshots); otherwise the app-wide setting decides.
  const [hidden, setHidden] = React.useState(
    globalHidden || params.hidden === "1",
  );
  const [busy, setBusy] = React.useState(false);
  const frame = React.useRef<View>(null);
  const { width: screen } = useWindowDimensions();
  const year = params.kind === "year";
  const ratio = year ? STORY_RATIO : MONTH_RATIO;
  // Leave room for the switch and button under the preview on a phone.
  const width = Math.min(MAX_WIDTH, screen - 48, year ? 300 : 320);

  const share = async () => {
    if (busy) return;
    haptic("light");
    setBusy(true);
    try {
      await shareViewAsImage(
        frame,
        year ? `review-${params.ref ?? ""}` : `report-${params.ref ?? ""}`,
        "Share image",
      );
    } catch {
      showToast({ message: "Could not create image" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerClassName="items-stretch gap-6 pb-10 pt-4"
    >
      <Stack.Screen
        options={{
          ...barLeft(
            <Button
              variant="barSecondary"
              size="sm"
              onPress={() => router.back()}
            >
              Cancel
            </Button>,
          ),
        }}
      />
      <View className="items-center">
        {year ? (
          <YearPreview
            frame={frame}
            width={width}
            ratio={ratio}
            year={params.ref}
            card={params.card}
            hidden={hidden}
          />
        ) : (
          <MonthPreview
            frame={frame}
            width={width}
            ratio={ratio}
            month={params.ref}
            hidden={hidden}
          />
        )}
      </View>
      <ListGroup>
        <ListRow
          label="Hide amounts"
          icon={{ name: "eye.slash", color: "indigo" }}
          switchValue={hidden}
          onSwitchChange={(value) => {
            haptic("selection");
            setHidden(value);
          }}
        />
      </ListGroup>
      <View className="px-4">
        <Button size="lg" onPress={share} loading={busy}>
          Share image
        </Button>
      </View>
    </ScrollView>
  );
}

function usePreviewMoney(currency: string, hidden: boolean) {
  const money = useMoneyContext();
  // The share option decides on its own: the image can show amounts even while the app hides them.
  const base = maskLocale(money.locale, false);
  return React.useMemo(
    () => makeReportMoney(currency, base, money.showDecimals, hidden),
    [currency, base, money.showDecimals, hidden],
  );
}

function MonthPreview({
  frame,
  width,
  ratio,
  month,
  hidden,
}: {
  frame: React.RefObject<View | null>;
  width: number;
  ratio: number;
  month: string | undefined;
  hidden: boolean;
}) {
  const settings = useSettings();
  const today = useTodayKey();
  const periodSettings = React.useMemo<PeriodSettings>(
    () => ({
      weekStart: settings.week_start,
      monthStart: settings.month_start,
    }),
    [settings.week_start, settings.month_start],
  );
  const period = React.useMemo(
    () => reportPeriod(month, today, periodSettings),
    [month, today, periodSettings],
  );
  const report = useMonthReport(period, periodSettings, today);
  const money = usePreviewMoney(report.currency, hidden);
  return (
    <ShareFrame
      ref={frame}
      width={width}
      ratio={ratio}
      caption={periodLabel(period)}
    >
      <MonthShareCard
        report={report}
        money={money}
        today={today}
        weekStart={settings.week_start}
      />
    </ShareFrame>
  );
}

function YearPreview({
  frame,
  width,
  ratio,
  year,
  card,
  hidden,
}: {
  frame: React.RefObject<View | null>;
  width: number;
  ratio: number;
  year: string | undefined;
  card: string | undefined;
  hidden: boolean;
}) {
  const settings = useSettings();
  const today = useTodayKey();
  const thisYear = parseKey(today).year;
  const parsed = Number.parseInt(year ?? "", 10);
  const value =
    Number.isFinite(parsed) && parsed <= thisYear ? parsed : thisYear;
  const review = useYearReview(value, today);
  const money = usePreviewMoney(review.currency, hidden);
  const cards = reviewCards(review);
  const kind: ReviewCardKind = cards.find((c) => c === card) ?? "summary";
  return (
    <ShareFrame
      ref={frame}
      width={width}
      ratio={ratio}
      caption={`${value} in review`}
    >
      <ReviewCard
        kind={cards.includes(kind) ? kind : (cards[0] ?? "intro")}
        review={review}
        money={money}
        today={today}
        weekStart={settings.week_start}
        still
        compact
        insets={{ top: 20, bottom: 8 }}
      />
    </ShareFrame>
  );
}
