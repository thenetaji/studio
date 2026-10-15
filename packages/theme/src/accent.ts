import { useSyncExternalStore } from "react";
import { Uniwind } from "uniwind";

import {
  accentPreset,
  accentPresets,
  configureTheme,
  type AccentPresetKey,
} from "./tokens";

let current: AccentPresetKey = accentPreset;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Re-skin the accent at runtime: JS tokens and the `--tint*` CSS variables together. */
export function setAccent(key: AccentPresetKey): void {
  if (key === current || !accentPresets[key]) return;
  current = key;
  configureTheme({ accentPreset: key });
  for (const scheme of ["light", "dark"] as const) {
    const a = accentPresets[key][scheme];
    Uniwind.updateCSSVariables(scheme, {
      "--tint": a.accent,
      "--tint-soft": a.accentSoft,
      "--tint-text": a.accentText,
      "--tint-deep": a.accentDeep,
      "--primary-foreground": a.onAccent,
      "--accent-foreground": a.onAccent,
    });
  }
  listeners.forEach((listener) => listener());
}

export function useAccent(): AccentPresetKey {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => current,
  );
}
