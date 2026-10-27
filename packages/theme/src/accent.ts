import { useSyncExternalStore } from "react";
import { Uniwind } from "uniwind";

import {
  accentPreset,
  accentPresets,
  categoryColors,
  categoryInk,
  categoryKeys,
  configureTheme,
  monoCategoryColors,
  palettePreset,
  palettes,
  withAlpha,
  type AccentPresetKey,
  type CategoryMode,
  type PaletteKey,
} from "./tokens";

type Look = {
  accent: AccentPresetKey;
  palette: PaletteKey;
  categories: CategoryMode;
};

let current: Look = {
  accent: accentPreset,
  palette: palettePreset,
  categories: "mono",
};
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Pushes the current accent and palette into the JS tokens and the CSS variables behind the class names. */
function apply(): void {
  configureTheme({ accentPreset: current.accent, palette: current.palette });
  for (const scheme of ["light", "dark"] as const) {
    const a = accentPresets[current.accent][scheme];
    const p = palettes[current.palette][scheme];
    const mono = current.categories === "mono";
    const cats = (mono ? monoCategoryColors : categoryColors)[scheme];
    const catVars: Record<string, string> = {};
    for (const key of categoryKeys) {
      catVars[`--cat-${key}`] = cats[key];
      catVars[`--cat-${key}-ink`] = mono ? cats[key] : categoryInk[key];
    }
    Uniwind.updateCSSVariables(scheme, {
      ...catVars,
      "--tint": a.accent,
      "--tint-soft": a.accentSoft,
      "--tint-text": a.accentText,
      "--tint-deep": a.accentDeep,
      "--primary-foreground": a.onAccent,
      "--accent-foreground": a.onAccent,
      "--bg": p.bg,
      "--surface": p.surface,
      "--elevated": p.elevated,
      "--hairline": p.border,
      "--separator": p.separator,
      "--label": p.text,
      "--label-secondary": p.textSecondary,
      "--label-tertiary": p.textTertiary,
      "--positive": p.income,
      "--positive-soft": withAlpha(p.income, scheme === "dark" ? 0.14 : 0.1),
      "--negative": p.expense,
      "--caution": p.warning,
      "--fill": p.fill,
      "--overlay": p.overlay,
      "--overlay-label": p.overlayText,
    });
  }
  listeners.forEach((listener) => listener());
}

/** Re-skin the accent at runtime: JS tokens and the `--tint*` CSS variables together. */
export function setAccent(key: AccentPresetKey): void {
  if (key === current.accent || !accentPresets[key]) return;
  current = { ...current, accent: key };
  apply();
}

/** Switch the surface palette (System, Titanium, Paper) at runtime. */
export function setPalette(key: PaletteKey): void {
  if (key === current.palette || !palettes[key]) return;
  current = { ...current, palette: key };
  apply();
}

/** Draw categories in mono greys or in colour. */
export function setCategoryMode(mode: CategoryMode): void {
  if (mode === current.categories) return;
  current = { ...current, categories: mode };
  apply();
}

export function useCategoryMode(): CategoryMode {
  return useSyncExternalStore(
    subscribe,
    () => current.categories,
    () => current.categories,
  );
}

export function useAccent(): AccentPresetKey {
  return useSyncExternalStore(
    subscribe,
    () => current.accent,
    () => current.accent,
  );
}

export function usePalette(): PaletteKey {
  return useSyncExternalStore(
    subscribe,
    () => current.palette,
    () => current.palette,
  );
}
