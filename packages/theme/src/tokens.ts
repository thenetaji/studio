export type Scheme = "light" | "dark";

export const categoryKeys = [
  "red",
  "orange",
  "amber",
  "lime",
  "green",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "purple",
  "pink",
  "brown",
  "gray",
] as const;

export type CategoryColorKey = (typeof categoryKeys)[number];

export type SemanticColors = {
  bg: string;
  surface: string;
  elevated: string;
  border: string;
  separator: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  onAccent: string;
  income: string;
  expense: string;
  warning: string;
  fill: string;
  overlay: string;
  overlayText: string;
};

export type AccentPresetKey = "brass" | "slate" | "sage" | "copper" | "ivory";

/** The accent is one token group: fill, link text, soft tint, text on the fill, pressed fill. */
export type AccentColors = Pick<
  SemanticColors,
  "accent" | "accentText" | "accentSoft" | "onAccent"
> & { accentDeep: string };

export const accentPresets: Record<
  AccentPresetKey,
  Record<Scheme, AccentColors>
> = {
  brass: {
    light: {
      accent: "#C69E58",
      accentText: "#936923",
      accentSoft: "rgba(198,158,88,0.14)",
      onAccent: "#15120B",
      accentDeep: "#BA904C",
    },
    dark: {
      accent: "#DEC084",
      accentText: "#DEC084",
      accentSoft: "rgba(222,192,132,0.14)",
      onAccent: "#15120B",
      accentDeep: "#BA904C",
    },
  },
  slate: {
    light: {
      accent: "#56708E",
      accentText: "#435A75",
      accentSoft: "rgba(86,112,142,0.12)",
      onAccent: "#FFFFFF",
      accentDeep: "#4A6280",
    },
    dark: {
      accent: "#A9BCD3",
      accentText: "#A9BCD3",
      accentSoft: "rgba(169,188,211,0.14)",
      onAccent: "#0E131A",
      accentDeep: "#8296AF",
    },
  },
  sage: {
    light: {
      accent: "#5F7A57",
      accentText: "#4B6345",
      accentSoft: "rgba(95,122,87,0.12)",
      onAccent: "#FFFFFF",
      accentDeep: "#536C4C",
    },
    dark: {
      accent: "#B2C7A8",
      accentText: "#B2C7A8",
      accentSoft: "rgba(178,199,168,0.14)",
      onAccent: "#10160E",
      accentDeep: "#8DA582",
    },
  },
  copper: {
    light: {
      accent: "#A86A52",
      accentText: "#8A533E",
      accentSoft: "rgba(168,106,82,0.12)",
      onAccent: "#FFFFFF",
      accentDeep: "#955D47",
    },
    dark: {
      accent: "#DDAA93",
      accentText: "#DDAA93",
      accentSoft: "rgba(221,170,147,0.14)",
      onAccent: "#1C110C",
      accentDeep: "#BC856D",
    },
  },
  ivory: {
    light: {
      accent: "#161310",
      accentText: "#161310",
      accentSoft: "rgba(22,19,16,0.08)",
      onAccent: "#F5F3EF",
      accentDeep: "#3A362F",
    },
    dark: {
      accent: "#F1EEE6",
      accentText: "#A4A19B",
      accentSoft: "rgba(241,238,230,0.12)",
      onAccent: "#0B0A08",
      accentDeep: "#CFCBC1",
    },
  },
};

/** Default accent; `setAccent` re-skins at runtime. global.css `--tint*` mirror this default. */
export const accentPreset: AccentPresetKey = "brass";

const base: Record<Scheme, Omit<SemanticColors, keyof AccentColors>> = {
  light: {
    bg: "#F5F3EF",
    surface: "#FFFFFF",
    elevated: "#FFFFFF",
    border: "rgba(22,19,16,0.07)",
    separator: "rgba(22,19,16,0.07)",
    text: "#161310",
    textSecondary: "#66635D",
    textTertiary: "#9B9891",
    income: "#048B56",
    expense: "#C92F36",
    warning: "#C9690C",
    fill: "#EAE8E3",
    overlay: "#161310",
    overlayText: "#F5F3EF",
  },
  dark: {
    bg: "#000000",
    surface: "#100F0D",
    elevated: "#191816",
    border: "rgba(255,255,255,0.07)",
    separator: "rgba(255,255,255,0.06)",
    text: "#F8F7F2",
    textSecondary: "#A4A19B",
    textTertiary: "#686660",
    income: "#64D8A4",
    expense: "#F66C6D",
    warning: "#FA9947",
    fill: "#1E1D1A",
    overlay: "#F5F3EF",
    overlayText: "#161310",
  },
};

export function buildColors(
  scheme: Scheme,
  preset: AccentPresetKey = accentPreset,
): SemanticColors & { accentDeep: string } {
  return { ...base[scheme], ...accentPresets[preset][scheme] };
}

export const colors: Record<Scheme, SemanticColors & { accentDeep: string }> = {
  light: buildColors("light"),
  dark: buildColors("dark"),
};

export type ThemeOverrides = {
  /** Switch to another built-in accent preset. */
  accentPreset?: AccentPresetKey;
  /** Or supply the app's own accent group per scheme (wins over `accentPreset`). */
  accent?: Record<Scheme, AccentColors>;
};

/**
 * Per-app theme override: call once at startup, before the first render. Updates `colors` in place so every
 * `useTokens()` consumer sees it. The category palette keys (`categoryKeys`) are stable and are not overridable,
 * because stored data refers to them. The app's global.css `--tint*` variables must be changed to match.
 */
export function configureTheme(overrides: ThemeOverrides): void {
  for (const scheme of ["light", "dark"] as const) {
    const accent =
      overrides.accent?.[scheme] ??
      accentPresets[overrides.accentPreset ?? accentPreset][scheme];
    Object.assign(colors[scheme], accent);
  }
}

/** Mint income wash (pill backgrounds). */
export const incomeSoft: Record<Scheme, string> = {
  light: "rgba(4,139,86,0.10)",
  dark: "rgba(100,216,164,0.12)",
};

/** Data colours for charts and swatches: `lit` on black, `light-data` on paper. */
export const categoryColors: Record<
  Scheme,
  Record<CategoryColorKey, string>
> = {
  light: {
    red: "#B34C4D",
    orange: "#AE5517",
    amber: "#AE7C04",
    lime: "#7A8A10",
    green: "#238744",
    teal: "#008478",
    cyan: "#007E9C",
    blue: "#3672BE",
    indigo: "#6765BD",
    purple: "#8759AD",
    pink: "#A74D83",
    brown: "#826144",
    gray: "#7D7A75",
  },
  dark: {
    red: "#FE8A88",
    orange: "#F7945A",
    amber: "#F3B94C",
    lime: "#B6CA59",
    green: "#73C786",
    teal: "#56C7B8",
    cyan: "#54C1E3",
    blue: "#7CB4FE",
    indigo: "#A5A7FE",
    purple: "#CA98F5",
    pink: "#EF8BC5",
    brown: "#C7A384",
    gray: "#A19E99",
  },
};

/** Solid tile fill (same in both schemes); white glyph on top. */
export const categoryInk: Record<CategoryColorKey, string> = {
  red: "#C6484C",
  orange: "#CD6108",
  amber: "#BE8700",
  lime: "#859700",
  green: "#009241",
  teal: "#008C80",
  cyan: "#0786A5",
  blue: "#2E78D5",
  indigo: "#6D68D3",
  purple: "#935AC0",
  pink: "#B74A8E",
  brown: "#917257",
  gray: "#65635F",
};

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
} as const;
export const gutter = 16;

export const radii = {
  key: 8,
  tile: 999,
  button: 12,
  card: 18,
  sheet: 20,
  pill: 999,
} as const;

export type TypeStyle = {
  size: number;
  line: number;
  weight: "400" | "500" | "600" | "700";
  tracking: number;
};

export const typeScale = {
  display: { size: 54, line: 60, weight: "700", tracking: -2.4 },
  hero: { size: 44, line: 50, weight: "700", tracking: -2 },
  amountEntry: { size: 44, line: 52, weight: "600", tracking: -1 },
  largeTitle: { size: 34, line: 41, weight: "700", tracking: -0.4 },
  title1: { size: 28, line: 34, weight: "700", tracking: -0.3 },
  title2: { size: 22, line: 28, weight: "600", tracking: -0.2 },
  headline: { size: 17, line: 22, weight: "600", tracking: 0 },
  body: { size: 17, line: 22, weight: "400", tracking: 0 },
  callout: { size: 16, line: 21, weight: "400", tracking: 0 },
  subhead: { size: 15, line: 20, weight: "400", tracking: 0 },
  footnote: { size: 13, line: 18, weight: "400", tracking: 0 },
  caption: { size: 12, line: 16, weight: "500", tracking: 0.1 },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof typeScale;

export const durations = {
  press: 120,
  chip: 200,
  progress: 200,
  row: 250,
  countUp: 400,
  toast: 5000,
} as const;

export const springs = {
  press: { damping: 20, stiffness: 300, mass: 0.8 },
  layout: { damping: 18, stiffness: 220 },
  sheetChip: { damping: 16, stiffness: 180 },
} as const;

export const pressScale = {
  row: 0.97,
  card: 0.97,
  key: 0.92,
  fab: 0.92,
} as const;
export const pressOpacity = { text: 0.6 } as const;

export const shadows = {
  fab: {
    shadowColor: "#DEC084",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  toast: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
} as const;

export const dynamicType = {
  hero: 1.4,
  keypad: 1.2,
  rowAmount: 1.6,
  default: 2,
} as const;

export function withAlpha(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
