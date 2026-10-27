import {
  currencySymbol,
  getCurrency,
  minorDigits,
  normalizeCurrency,
} from "./currencies";
import {
  groupInteger,
  resolveNumberLocale,
  type NumberLocale,
} from "./locales";

export const MINUS = "−";
const NBSP = " ";

export type SignMode = "auto" | "minus" | "plus" | "none";

export interface FormatMoneyOptions {
  locale?: string;
  /**
   * auto: minus only when negative. minus: expense prefix. plus: income prefix.
   * none: never show a sign. A zero amount never gets a sign.
   */
  sign?: SignMode;
  compact?: boolean;
  /** Fraction digits to show, at most the currency's minor digits. */
  decimals?: number;
}

const POW10 = [1, 10, 100, 1000, 10000, 100000, 1000000];

function pow10(n: number): number {
  return POW10[n] ?? 10 ** n;
}

/** Round half away from zero when dropping `drop` trailing minor digits, in integers. */
function dropDigits(abs: number, drop: number): number {
  if (drop <= 0) return abs;
  const divisor = pow10(drop);
  return Math.floor((abs + divisor / 2) / divisor);
}

interface Parts {
  integer: string;
  fraction: string;
}

function splitMinor(abs: number, digits: number, decimals: number): Parts {
  const rounded = dropDigits(abs, digits - decimals);
  const unit = pow10(decimals);
  const integer = String(Math.floor(rounded / unit));
  const fraction =
    decimals > 0 ? String(rounded % unit).padStart(decimals, "0") : "";
  return { integer, fraction };
}

function signPrefix(minor: number, mode: SignMode): string {
  if (minor === 0 || mode === "none") return "";
  if (mode === "minus") return MINUS;
  if (mode === "plus") return "+";
  return minor < 0 ? MINUS : "";
}

function wrapSymbol(
  number: string,
  symbol: string,
  locale: NumberLocale,
): string {
  if (locale.symbol === "suffix") return `${number}${NBSP}${symbol}`;
  return `${symbol}${locale.symbolSpace ? NBSP : ""}${number}`;
}

interface CompactUnit {
  suffix: string;
  size: number;
}

const WESTERN_UNITS: readonly CompactUnit[] = [
  { suffix: "B", size: 1e9 },
  { suffix: "M", size: 1e6 },
  { suffix: "K", size: 1e3 },
];
const INDIAN_UNITS: readonly CompactUnit[] = [
  { suffix: "Cr", size: 1e7 },
  { suffix: "L", size: 1e5 },
  { suffix: "K", size: 1e3 },
];

function compactNumber(
  abs: number,
  digits: number,
  locale: NumberLocale,
  units: readonly CompactUnit[],
): string {
  const major = abs / pow10(digits);
  const tenths = (value: number) => Math.round(value * 10) / 10;
  const ascending = [...units].reverse();
  let chosen: CompactUnit | undefined;
  for (const unit of ascending) {
    if (major >= unit.size) chosen = unit;
  }
  let value = tenths(major / (chosen?.size ?? 1));
  const next = ascending[chosen ? ascending.indexOf(chosen) + 1 : 0];
  // A value that rounds up to the next unit's size is promoted (999.96K -> 1M).
  if (next && value * (chosen?.size ?? 1) >= next.size) {
    chosen = next;
    value = tenths(major / next.size);
  }
  return `${trimTenths(value, locale)}${chosen?.suffix ?? ""}`;
}

function trimTenths(value: number, locale: NumberLocale): string {
  const whole = Math.floor(value);
  const tenth = Math.round((value - whole) * 10);
  const integer = groupInteger(String(whole), locale);
  return tenth === 0 ? integer : `${integer}${locale.decimal}${tenth}`;
}

/** Private-use subtag appended to a locale tag to request masked output; see `maskLocale`. */
const HIDE_TAG = "-x-hide";
export const MASK = "••••";
export const MASK_SHORT = "••";

/**
 * The privacy switch rides on the locale string every display path already passes to `formatMoney`.
 * Memoised view models and React Compiler caches therefore refresh the moment `hidden` flips, with
 * no global state. Inputs and exports never pass a masked locale, so they stay readable.
 */
export function maskLocale(
  tag: string | undefined,
  hidden: boolean,
): string | undefined {
  const base = tag?.endsWith(HIDE_TAG) ? tag.slice(0, -HIDE_TAG.length) : tag;
  if (!hidden) return base;
  return `${base ?? "en"}${HIDE_TAG}`;
}

export function isMaskedLocale(tag: string | undefined): boolean {
  return !!tag && tag.endsWith(HIDE_TAG);
}

/** Replaces a formatted amount's digits with bullets, keeping the sign and currency symbol. */
export function maskMoney(text: string): string {
  return text.replace(/\d[\d.,\u00a0\u202f]*(?:Cr|[KMBL])?/, MASK);
}

export function formatMoney(
  minor: number,
  currency: string,
  options: FormatMoneyOptions = {},
): string {
  const { locale: tag, sign = "auto", compact = false } = options;
  const hidden = isMaskedLocale(tag);
  const code = normalizeCurrency(currency);
  const digits = minorDigits(code);
  const locale = resolveNumberLocale(tag);
  const abs = Math.abs(Math.trunc(minor));
  const prefix = signPrefix(minor, sign);
  const symbol = currencySymbol(code);

  let number: string;
  if (hidden) {
    number = compact ? MASK_SHORT : MASK;
  } else if (compact) {
    const indianUnits = locale.style === "indian" || code === "INR";
    number = compactNumber(
      abs,
      digits,
      locale,
      indianUnits ? INDIAN_UNITS : WESTERN_UNITS,
    );
  } else {
    const decimals = Math.min(Math.max(options.decimals ?? digits, 0), digits);
    const { integer, fraction } = splitMinor(abs, digits, decimals);
    number =
      groupInteger(integer, locale) +
      (fraction ? `${locale.decimal}${fraction}` : "");
  }
  return `${prefix}${wrapSymbol(number, symbol, locale)}`;
}

function speechNumber(abs: number, digits: number): string {
  const { integer, fraction } = splitMinor(abs, digits, digits);
  const grouped = groupInteger(integer, resolveNumberLocale("en-US"));
  return fraction && Number(fraction) !== 0
    ? `${grouped}.${fraction}`
    : grouped;
}

/** "minus 1,240 rupees"; always en-US digits so screen readers don't mis-group. */
export function formatMoneyForSpeech(
  minor: number,
  currency: string,
  options: { sign?: SignMode; locale?: string } = {},
): string {
  if (isMaskedLocale(options.locale)) return "Hidden";
  const code = normalizeCurrency(currency);
  const info = getCurrency(code);
  const digits = minorDigits(code);
  const abs = Math.abs(Math.trunc(minor));
  const text = speechNumber(abs, digits);
  const singular = text === "1";
  const name = info ? info.name[singular ? 0 : 1] : code;
  const mode = options.sign ?? "auto";
  const word =
    minor === 0 || mode === "none"
      ? ""
      : mode === "plus"
        ? "plus "
        : mode === "minus" || minor < 0
          ? "minus "
          : "";
  return `${word}${text} ${name}`;
}
