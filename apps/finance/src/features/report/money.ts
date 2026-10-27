import * as React from "react";

import {
  formatMoney,
  formatMoneyForSpeech,
  isMaskedLocale,
  maskLocale,
} from "@studio/money";
import { useMoneyContext } from "@/features/transactions/use-money-context";

export interface ReportMoney {
  currency: string;
  locale: string | undefined;
  /** True when amounts are masked (app-wide Hide amounts, or the share option). */
  hidden: boolean;
  /** Honours Show decimals. */
  full: (minor: number) => string;
  /** No decimals. */
  whole: (minor: number) => string;
  /** "₹1.2L", for chart labels. */
  compact: (minor: number) => string;
  /** With a sign when negative ("−₹1,240"). */
  signed: (minor: number) => string;
  /** "+₹1,240" / "−₹1,240" for changes. */
  change: (minor: number) => string;
  speech: (minor: number) => string;
}

export function makeReportMoney(
  currency: string,
  locale: string | undefined,
  showDecimals: boolean,
  hidden: boolean,
): ReportMoney {
  const tag = maskLocale(locale, hidden);
  const decimals = showDecimals ? undefined : 0;
  return {
    currency,
    locale: tag,
    hidden,
    full: (v) =>
      formatMoney(v, currency, { locale: tag, sign: "none", decimals }),
    whole: (v) =>
      formatMoney(v, currency, { locale: tag, sign: "none", decimals: 0 }),
    compact: (v) =>
      formatMoney(v, currency, { locale: tag, sign: "none", compact: true }),
    signed: (v) =>
      formatMoney(v, currency, { locale: tag, sign: "auto", decimals }),
    change: (v) =>
      formatMoney(Math.abs(v), currency, {
        locale: tag,
        sign: v < 0 ? "minus" : v > 0 ? "plus" : "none",
        decimals: 0,
      }),
    speech: (v) =>
      formatMoneyForSpeech(v, currency, { locale: tag, sign: "auto" }),
  };
}

/**
 * Money formatting for report screens. Goes through `formatMoney` with the app's (possibly masked) locale, so the
 * app-wide Hide amounts mode applies; `forceHidden` masks as well (share images).
 */
export function useReportMoney(
  currency: string,
  forceHidden = false,
): ReportMoney {
  const money = useMoneyContext();
  return React.useMemo(
    () =>
      makeReportMoney(
        currency,
        money.locale,
        money.showDecimals,
        forceHidden || isMaskedLocale(money.locale),
      ),
    [currency, money.locale, money.showDecimals, forceHidden],
  );
}
