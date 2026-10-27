import { create } from "zustand";

import type { IconBackground, IconStyle } from "./types";

type IconPrefsState = {
  style: IconStyle;
  background: IconBackground;
  setStyle: (style: IconStyle) => void;
  setBackground: (background: IconBackground) => void;
};

/**
 * In-memory mirror of the `icon_style` / `icon_background` settings. Hundreds of tiles read it, so they
 * subscribe to this store instead of each running a settings query.
 */
export const useIconPrefs = create<IconPrefsState>((set) => ({
  style: "sf",
  background: "mono",
  setStyle: (style) => set({ style }),
  setBackground: (background) => set({ background }),
}));
