export type IconStyle =
  | "phosphor-duotone"
  | "phosphor-fill"
  | "hugeicons"
  | "solar"
  | "lucide"
  | "sf";
export type IconBackground =
  | "mono"
  | "soft"
  | "solid"
  | "graphite-glyph"
  | "graphite-accent"
  | "glass-glow"
  | "glass-ice"
  | "tonal"
  | "glyph-only";

export const ICON_STYLES: readonly IconStyle[] = [
  "sf",
  "phosphor-duotone",
  "phosphor-fill",
  "hugeicons",
  "solar",
  "lucide",
];
export const ICON_BACKGROUNDS: readonly IconBackground[] = [
  "mono",
  "soft",
  "solid",
  "glyph-only",
  "graphite-glyph",
  "graphite-accent",
  "glass-glow",
  "glass-ice",
  "tonal",
];

/** Styles drawn from bundled SVG data (every style except native SF Symbols). */
export type SvgIconStyle = Exclude<IconStyle, "sf">;

export const ICON_STYLE_LABELS: Record<
  IconStyle,
  { label: string; detail: string }
> = {
  "phosphor-duotone": { label: "Duotone", detail: "Soft two-layer glyphs" },
  "phosphor-fill": { label: "Solid", detail: "Bold filled shapes" },
  hugeicons: { label: "Outline", detail: "Rounded, even strokes" },
  solar: { label: "Solar", detail: "Chunky duotone" },
  lucide: { label: "Line", detail: "Crisp and minimal" },
  sf: { label: "SF Symbols", detail: "Apple's own symbols, as in iOS" },
};

export const ICON_BACKGROUND_LABELS: Record<
  IconBackground,
  { label: string; detail: string }
> = {
  mono: { label: "Metal", detail: "Symbol on a brushed-metal tile" },
  soft: { label: "Soft tiles", detail: "Coloured symbol on a faint tint" },
  solid: {
    label: "Colour tiles",
    detail: "White symbol on colour, like iOS Settings",
  },
  "graphite-glyph": { label: "Graphite", detail: "Coloured glyph on graphite" },
  "graphite-accent": {
    label: "Graphite accent",
    detail: "White glyph, coloured accent",
  },
  "glass-glow": { label: "Glass glow", detail: "Glass lit from within" },
  "glass-ice": { label: "Glass ice", detail: "Frosted, one finish" },
  tonal: { label: "Tonal", detail: "Deep tint of each colour" },
  "glyph-only": { label: "Symbols only", detail: "Coloured symbol, no tile" },
};
