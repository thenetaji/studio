import { useMemo } from "react";
import { useUniwind } from "uniwind";

import { useAccent, useCategoryMode, usePalette } from "./accent";

import {
  buildColors,
  categoryColors,
  categoryInk,
  monoCategoryColors,
  durations,
  radii,
  shadows,
  spacing,
  springs,
  typeScale,
  withAlpha,
  type CategoryColorKey,
  type Scheme,
} from "./tokens";

export function useTokens() {
  const { theme } = useUniwind();
  const scheme: Scheme = theme === "dark" ? "dark" : "light";
  const accent = useAccent();
  const palette = usePalette();
  const categoryMode = useCategoryMode();
  return useMemo(() => {
    const colors = buildColors(scheme, accent, palette);
    return {
      scheme,
      isDark: scheme === "dark",
      accentKey: accent,
      paletteKey: palette,
      colors,
      categoryMode,
      category:
        categoryMode === "mono"
          ? monoCategoryColors[scheme]
          : categoryColors[scheme],
      incomeSoft: withAlpha(colors.income, scheme === "dark" ? 0.14 : 0.1),
      ink: categoryMode === "mono" ? monoCategoryColors[scheme] : categoryInk,
      spacing,
      radii,
      typeScale,
      durations,
      springs,
      shadows,
    };
  }, [scheme, accent, palette, categoryMode]);
}

export function useCategoryColor(key: CategoryColorKey): string {
  const { category } = useTokens();
  return category[key];
}
