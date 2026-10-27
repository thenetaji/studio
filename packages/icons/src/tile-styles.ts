import { clear, hsl, hueOf } from "./color";
import type { IconBackground } from "./types";

/** `#RRGGBB` at `alpha`. */
const tint = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${alpha})`;
};

export type TileSpec = {
  kind: "none" | "plain" | "glass";
  /** Icon size as a fraction of the tile footprint. */
  iconScale: number;
  icon: string;
  secondary?: string;
  secondaryOpacity?: number;
  /** plain tiles */
  base?: string;
  rim?: string;
  /** glass tiles: CSS gradient layers */
  face?: string;
  rimGradient?: string;
  sheen?: string;
  /** Radial halo painted behind the glyph. */
  halo?: string;
};

const CORNER = 0.3;
export const tileRadius = (size: number) => Math.round(size * CORNER * 10) / 10;

/**
 * Visual spec for each treatment. `color` is the category colour for the current scheme (from tokens), so
 * palette changes flow through. Dark values follow the approved renders (.review/icon-bg2); light is a
 * designed counterpart, not an inversion.
 */
export function tileSpec(
  background: IconBackground,
  dark: boolean,
  color: string,
): TileSpec {
  const h = hueOf(color);
  switch (background) {
    // Mono: no category colour at all. The symbol in ink on a neutral grey tile, as in Apple's own lists.
    case "mono":
      return dark
        ? {
            kind: "plain",
            iconScale: 0.52,
            icon: "#F2F2F7",
            base: "#2C2C2E",
            rim: "rgba(255,255,255,0.05)",
          }
        : {
            kind: "plain",
            iconScale: 0.52,
            icon: "#1C1C1E",
            base: "#EFEFF4",
            rim: "rgba(0,0,0,0.04)",
          };
    // The symbol in its colour on a faint wash of the same colour.
    case "soft":
      return {
        kind: "plain",
        iconScale: 0.54,
        icon: color,
        base: tint(color, dark ? 0.2 : 0.13),
        rim: "transparent",
      };
    // iOS Settings: the category colour as a solid continuous-corner square, a white symbol on top.
    case "solid":
      return {
        kind: "plain",
        iconScale: 0.58,
        icon: "#FFFFFF",
        base: color,
        rim: dark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
      };
    case "graphite-glyph":
      return dark
        ? {
            kind: "plain",
            iconScale: 0.5,
            icon: color,
            base: "#161618",
            rim: "rgba(255,255,255,0.08)",
          }
        : {
            kind: "plain",
            iconScale: 0.5,
            icon: color,
            base: "#F1EFEA",
            rim: "rgba(20,18,14,0.08)",
          };
    case "graphite-accent":
      return dark
        ? {
            kind: "plain",
            iconScale: 0.5,
            icon: "#F5F5F7",
            secondary: color,
            secondaryOpacity: 0.95,
            base: "#161618",
            rim: "rgba(255,255,255,0.08)",
          }
        : {
            kind: "plain",
            iconScale: 0.5,
            icon: "#1A1917",
            secondary: color,
            secondaryOpacity: 0.95,
            base: "#F1EFEA",
            rim: "rgba(20,18,14,0.08)",
          };
    case "tonal": {
      return dark
        ? {
            kind: "plain",
            iconScale: 0.5,
            icon: hsl(h, 60, 74),
            secondary: hsl(h, 60, 74),
            secondaryOpacity: 0.3,
            base: hsl(h, 28, 13),
            rim: hsl(h, 30, 22, 0.6),
          }
        : {
            kind: "plain",
            iconScale: 0.5,
            icon: hsl(h, 52, 32),
            secondary: hsl(h, 52, 32),
            secondaryOpacity: 0.3,
            base: hsl(h, 55, 94),
            rim: hsl(h, 42, 84, 0.9),
          };
    }
    case "glass-glow": {
      if (dark) {
        const glow = hsl(h, 80, 54, 0.85);
        return {
          kind: "glass",
          iconScale: 0.5,
          icon: "#FFFFFF",
          secondary: "#FFFFFF",
          secondaryOpacity: 0.35,
          face: `radial-gradient(ellipse 125% 100% at 50% 118%, ${glow}, ${clear(glow)} 68%), linear-gradient(180deg, #1B1D22, #0A0B0E)`,
          rimGradient: `linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.04) 60%, ${hsl(h, 70, 60, 0.35)})`,
          sheen:
            "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0))",
          halo: hsl(h, 85, 62, 0.5),
        };
      }
      const glow = hsl(h, 90, 76, 0.6);
      return {
        kind: "glass",
        iconScale: 0.5,
        icon: "#FFFFFF",
        secondary: "#FFFFFF",
        secondaryOpacity: 0.4,
        face: `radial-gradient(ellipse 120% 90% at 50% 115%, ${glow}, ${clear(glow)} 62%), linear-gradient(180deg, ${hsl(h, 62, 60)}, ${hsl(h, 64, 42)})`,
        rimGradient:
          "linear-gradient(180deg, rgba(255,255,255,0.8), rgba(255,255,255,0.1) 60%, rgba(20,18,14,0.22))",
        sheen:
          "linear-gradient(180deg, rgba(255,255,255,0.34), rgba(255,255,255,0))",
        halo: "rgba(255,255,255,0.22)",
      };
    }
    case "glass-ice": {
      if (dark) {
        const cyan = "rgba(120,190,255,0.28)";
        return {
          kind: "glass",
          iconScale: 0.5,
          icon: hsl(h, 70, 86),
          secondary: hsl(h, 75, 66),
          secondaryOpacity: 0.9,
          face: `radial-gradient(ellipse 120% 90% at 50% 120%, ${cyan}, ${clear(cyan)} 60%), linear-gradient(180deg, #1C2026, #0B0D10)`,
          rimGradient:
            "linear-gradient(180deg, rgba(225,240,255,0.55), rgba(255,255,255,0.05) 55%, rgba(140,200,255,0.25))",
          sheen:
            "linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0))",
        };
      }
      const cyan = "rgba(110,180,255,0.4)";
      return {
        kind: "glass",
        iconScale: 0.5,
        icon: hsl(h, 55, 30),
        secondary: hsl(h, 70, 48),
        secondaryOpacity: 0.85,
        face: `radial-gradient(ellipse 120% 90% at 50% 120%, ${cyan}, ${clear(cyan)} 60%), linear-gradient(180deg, #FFFFFF, #E3ECF5)`,
        rimGradient:
          "linear-gradient(180deg, rgba(255,255,255,1), rgba(60,90,130,0.1) 55%, rgba(80,140,200,0.32))",
        sheen:
          "linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0))",
      };
    }
    case "glyph-only":
      return { kind: "none", iconScale: 0.66, icon: color };
  }
}
