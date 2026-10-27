import { conceptMeta, sfAliases, type ConceptMeta } from "./generated/concepts";
import type { IconStyle, SvgIconStyle } from "./types";

type Pack = { viewBox: number; bodies: Record<string, string> };

/** Pick the pack lazily: with inline requires the unused styles are never evaluated at runtime. */
function loadPack(style: SvgIconStyle): Pack {
  /* eslint-disable @typescript-eslint/no-require-imports */
  switch (style) {
    case "phosphor-duotone":
      return require("./generated/phosphorDuotone") as Pack;
    case "phosphor-fill":
      return require("./generated/phosphorFill") as Pack;
    case "hugeicons":
      return require("./generated/hugeicons") as Pack;
    case "solar":
      return require("./generated/solar") as Pack;
    case "lucide":
      return require("./generated/lucide") as Pack;
  }
  /* eslint-enable @typescript-eslint/no-require-imports */
}

export const FALLBACK_CONCEPT = "tag";

const metaById = new Map<string, ConceptMeta>(
  conceptMeta.map((c) => [c.id, c]),
);

/** Resolve a stored name (concept id, SF Symbol name or old fallback name) to a concept id. */
export function conceptFor(name: string | null | undefined): string {
  if (!name) return FALLBACK_CONCEPT;
  if (metaById.has(name)) return name;
  const alias = sfAliases[name];
  if (alias) return alias;
  const bare = name.replace(/\.fill$/, "");
  return sfAliases[bare] ?? sfAliases[`${bare}.fill`] ?? FALLBACK_CONCEPT;
}

/** True when the name maps to a known concept (not the fallback). */
export function isKnownIcon(name: string): boolean {
  return metaById.has(name) || name in sfAliases;
}

/** The SF Symbol to draw for a stored name: the name itself when it is a known SF name, else the concept's symbol. */
export function sfSymbolFor(name: string): string {
  if (name in sfAliases) return name;
  return metaById.get(conceptFor(name))?.sf ?? "tag.fill";
}

export function conceptLabel(id: string): string {
  return metaById.get(conceptFor(id))?.label ?? "Icon";
}

const cache = new Map<string, string>();

/**
 * SVG markup for a concept in a style. `secondary` recolours the duotone layer (the `opacity` paths in
 * Phosphor and Solar); `secondaryOpacity` overrides its strength. Cached: tiles repeat across lists.
 */
export function iconXml(
  style: IconStyle,
  id: string,
  secondary?: string,
  secondaryOpacity?: number,
): string {
  // Off iOS, SF Symbols fall back to the filled set, the closest in weight and shape.
  const svgStyle: SvgIconStyle = style === "sf" ? "phosphor-fill" : style;
  const key = `${svgStyle}|${id}|${secondary ?? ""}|${secondaryOpacity ?? ""}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const pack = loadPack(svgStyle);
  let body = pack.bodies[id] ?? pack.bodies[FALLBACK_CONCEPT] ?? "";
  if (secondary || secondaryOpacity !== undefined) {
    body = body.replace(
      /opacity="(\.\d+)"/g,
      (_m, o: string) =>
        `${secondary ? `fill="${secondary}" ` : ""}opacity="${secondaryOpacity ?? o}"`,
    );
  }
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${pack.viewBox} ${pack.viewBox}">${body}</svg>`;
  if (cache.size > 2000) cache.clear();
  cache.set(key, xml);
  return xml;
}

export { conceptMeta };
export type { ConceptMeta };
