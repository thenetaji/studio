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

export type AccentPresetKey =
  | "blue"
  | "titanium"
  | "brass"
  | "slate"
  | "sage"
  | "copper"
  | "ivory";

/** The accent is one token group: fill, link text, soft tint, text on the fill, pressed fill. */
export type AccentColors = Pick<
  SemanticColors,
  "accent" | "accentText" | "accentSoft" | "onAccent"
> & { accentDeep: string };

export const accentPresets: Record<
  AccentPresetKey,
  Record<Scheme, AccentColors>
> = {
  // Apple system blue: the accessible light variant for text, the system tint for fills.
  blue: {
    light: {
      accent: "#007AFF",
      accentText: "#0066D6",
      accentSoft: "rgba(0,122,255,0.12)",
      onAccent: "#FFFFFF",
      accentDeep: "#0062CC",
    },
    dark: {
      accent: "#0A84FF",
      accentText: "#409CFF",
      accentSoft: "rgba(10,132,255,0.18)",
      onAccent: "#FFFFFF",
      accentDeep: "#0071E3",
    },
  },
  // Natural titanium: a warm metallic grey, brighter in dark mode where it is the hero.
  titanium: {
    light: {
      accent: "#5F584F",
      accentText: "#5F584F",
      accentSoft: "rgba(95,88,79,0.1)",
      onAccent: "#FFFFFF",
      accentDeep: "#4E4840",
    },
    dark: {
      accent: "#D9D2C5",
      accentText: "#D9D2C5",
      accentSoft: "rgba(217,210,197,0.14)",
      onAccent: "#121110",
      accentDeep: "#BDB5A7",
    },
  },
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
  // Ink: black on light, white on dark. The mono accent.
  ivory: {
    light: {
      accent: "#1C1C1E",
      accentText: "#1C1C1E",
      accentSoft: "rgba(28,28,30,0.08)",
      onAccent: "#FFFFFF",
      accentDeep: "#3A3A3C",
    },
    dark: {
      accent: "#F2F2F7",
      accentText: "#E5E5EA",
      accentSoft: "rgba(242,242,247,0.12)",
      onAccent: "#000000",
      accentDeep: "#D1D1D6",
    },
  },
};

/** Default accent; `setAccent` re-skins at runtime. global.css `--tint*` mirror this default. */
export const accentPreset: AccentPresetKey = "titanium";

/** The surface family: every non-accent token. `setPalette` switches it at runtime. */
export type PaletteKey = "system" | "titanium" | "paper";

export type PaletteColors = Omit<SemanticColors, keyof AccentColors>;

/** Default palette; global.css mirrors it. */
export const palettePreset: PaletteKey = "titanium";

export const palettes: Record<PaletteKey, Record<Scheme, PaletteColors>> = {
  // Apple's own apps (Wallet, Health): grouped grey background, white cards, system label greys.
  system: {
    light: {
      bg: "#F2F2F7",
      surface: "#FFFFFF",
      elevated: "#FFFFFF",
      border: "rgba(60,60,67,0.12)",
      separator: "rgba(60,60,67,0.18)",
      text: "#000000",
      textSecondary: "#6C6C70",
      textTertiary: "#A1A1A6",
      income: "#248A3D",
      expense: "#D70015",
      warning: "#C93400",
      fill: "#E9E9EE",
      overlay: "#1C1C1E",
      overlayText: "#FFFFFF",
    },
    dark: {
      bg: "#000000",
      surface: "#1C1C1E",
      elevated: "#2C2C2E",
      border: "rgba(84,84,88,0.36)",
      separator: "rgba(84,84,88,0.5)",
      text: "#FFFFFF",
      textSecondary: "#98989F",
      textTertiary: "#636366",
      income: "#30D158",
      expense: "#FF453A",
      warning: "#FF9F0A",
      fill: "#2C2C2E",
      overlay: "#F2F2F7",
      overlayText: "#000000",
    },
  },
  // Titanium: graphite and brushed-metal greys, made for dark mode first.
  titanium: {
    light: {
      bg: "#ECEBE8",
      surface: "#FAFAF8",
      elevated: "#FFFFFF",
      border: "rgba(40,36,30,0.09)",
      separator: "rgba(40,36,30,0.12)",
      text: "#1C1B19",
      textSecondary: "#6B6862",
      textTertiary: "#A19D96",
      income: "#2E7D4F",
      expense: "#C4302B",
      warning: "#B9580D",
      fill: "#E0DEDA",
      overlay: "#1C1B19",
      overlayText: "#F4F2EE",
    },
    dark: {
      bg: "#0A0A0B",
      surface: "#161617",
      elevated: "#1F1F21",
      border: "rgba(225,218,205,0.08)",
      separator: "rgba(225,218,205,0.09)",
      text: "#F4F2EE",
      textSecondary: "#A8A49C",
      textTertiary: "#6E6B66",
      income: "#7FD1A0",
      expense: "#F07A72",
      warning: "#E9B25C",
      fill: "#232325",
      overlay: "#F4F2EE",
      overlayText: "#1C1B19",
    },
  },
  // The original warm paper and black.
  paper: {
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
  },
};

export function buildColors(
  scheme: Scheme,
  preset: AccentPresetKey = accentPreset,
  palette: PaletteKey = palettePreset,
): SemanticColors & { accentDeep: string } {
  return { ...palettes[palette][scheme], ...accentPresets[preset][scheme] };
}

export const colors: Record<Scheme, SemanticColors & { accentDeep: string }> = {
  light: buildColors("light"),
  dark: buildColors("dark"),
};

export type ThemeOverrides = {
  /** Switch to another built-in accent preset. */
  accentPreset?: AccentPresetKey;
  /** Switch the surface palette. */
  palette?: PaletteKey;
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
    if (overrides.palette)
      Object.assign(colors[scheme], palettes[overrides.palette][scheme]);
    Object.assign(colors[scheme], accent);
  }
}

/** Mint income wash (pill backgrounds). */
export const incomeSoft: Record<Scheme, string> = {
  light: "rgba(4,139,86,0.10)",
  dark: "rgba(100,216,164,0.12)",
};

/**
 * Data colours for charts and swatches: Apple's system hues, softened about a quarter so a screen of categories
 * reads calm rather than neon. The dark set is lighter, not brighter. Every light mark holds 3:1 on white.
 */
export const categoryColors: Record<
  Scheme,
  Record<CategoryColorKey, string>
> = {
  light: {
    red: "#E5534B",
    orange: "#E8893A",
    amber: "#D29A17",
    lime: "#86AA30",
    green: "#36A865",
    teal: "#349FB2",
    cyan: "#3F9ACF",
    blue: "#3B78E0",
    indigo: "#6261C4",
    purple: "#965FCB",
    pink: "#DB5880",
    brown: "#9C8061",
    gray: "#8E8E93",
  },
  dark: {
    red: "#EF6B63",
    orange: "#F09A52",
    amber: "#E6BA4A",
    lime: "#A3C75C",
    green: "#58C482",
    teal: "#5DBCCC",
    cyan: "#6BB6E4",
    blue: "#6297EF",
    indigo: "#8A88DF",
    purple: "#B386E0",
    pink: "#EA7C9D",
    brown: "#B79B7B",
    gray: "#98989D",
  },
};

/** How categories are drawn: mono (greys told apart by lightness, the default) or colour. */
export type CategoryMode = "mono" | "colour";

/**
 * Mono category greys. Each key keeps one fixed step (colour follows the entity, never its rank), and the steps
 * are spread so neighbouring keys differ in lightness. Light steps hold 3:1 on white; dark steps on #1C1C1E.
 */
const MONO_STEPS: Record<CategoryColorKey, number> = {
  red: 0,
  orange: 2,
  amber: 4,
  lime: 1,
  green: 3,
  teal: 5,
  cyan: 1,
  blue: 0,
  indigo: 3,
  purple: 2,
  pink: 4,
  brown: 5,
  gray: 3,
};
const MONO_RAMP: Record<Scheme, readonly string[]> = {
  light: ["#1C1C1E", "#3A3A3C", "#525256", "#67676B", "#7A7A7E", "#8E8E93"],
  // Platinum to graphite with a faint warmth, like brushed titanium.
  dark: ["#ECEAE6", "#CBC8C2", "#ABA8A2", "#8E8C88", "#73726F", "#5B5B5E"],
};
const monoFor = (scheme: Scheme) =>
  Object.fromEntries(
    categoryKeys.map((key) => [key, MONO_RAMP[scheme][MONO_STEPS[key]]!]),
  ) as Record<CategoryColorKey, string>;

export const monoCategoryColors: Record<
  Scheme,
  Record<CategoryColorKey, string>
> = { light: monoFor("light"), dark: monoFor("dark") };

/** Solid tile fill (same in both schemes), as on iOS Settings icons; white glyph on top. */
export const categoryInk: Record<CategoryColorKey, string> = {
  red: "#E5534B",
  orange: "#E8893A",
  amber: "#D29A17",
  lime: "#86AA30",
  green: "#36A865",
  teal: "#349FB2",
  cyan: "#3F9ACF",
  blue: "#3B78E0",
  indigo: "#6261C4",
  purple: "#965FCB",
  pink: "#DB5880",
  brown: "#9C8061",
  gray: "#8E8E93",
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

/** SF Pro Rounded on iOS (as in Wallet and Fitness) for amounts; other platforms keep their system face. */
export const roundedFamily = "ui-rounded";

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
    shadowColor: "#000000",
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
