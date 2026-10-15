import { useMemo } from "react";
import { useUniwind } from "uniwind";

import { useAccent } from "./accent";

import {
  buildColors,
  categoryColors,
  categoryInk,
  durations,
  incomeSoft,
  radii,
  shadows,
  spacing,
  springs,
  typeScale,
  type CategoryColorKey,
  type Scheme,
} from "./tokens";

export function useTokens() {
  const { theme } = useUniwind();
  const scheme: Scheme = theme === "dark" ? "dark" : "light";
  const accent = useAccent();
  return useMemo(
    () => ({
      scheme,
      isDark: scheme === "dark",
      accentKey: accent,
      colors: buildColors(scheme, accent),
      category: categoryColors[scheme],
      incomeSoft: incomeSoft[scheme],
      ink: categoryInk,
      spacing,
      radii,
      typeScale,
      durations,
      springs,
      shadows,
    }),
    [scheme, accent],
  );
}

export function useCategoryColor(key: CategoryColorKey): string {
  const { category } = useTokens();
  return category[key];
}
