/** Home sections the owner can reorder and hide. The hero (greeting, amount, chart) always stays on top. */
export const HOME_SECTION_IDS = [
  "quick_add",
  "stats",
  "pockets",
  "coming_up",
  "heatmap",
  "top_categories",
  "recent",
] as const;

export type HomeSectionId = (typeof HOME_SECTION_IDS)[number];

export interface HomeSectionPref {
  id: HomeSectionId;
  visible: boolean;
}

export const HOME_SECTION_LABELS: Record<HomeSectionId, string> = {
  quick_add: "Quick add",
  stats: "Summary",
  pockets: "Pocket money",
  coming_up: "Coming up",
  heatmap: "Spending heatmap",
  top_categories: "Top categories",
  recent: "Recent",
};

export const DEFAULT_HOME_LAYOUT: readonly HomeSectionPref[] =
  HOME_SECTION_IDS.map((id) => ({ id, visible: true }));

const isSectionId = (value: unknown): value is HomeSectionId =>
  typeof value === "string" &&
  (HOME_SECTION_IDS as readonly string[]).includes(value);

/** Sections added in a later build that should land after a given section instead of at the end. */
const INSERT_AFTER: Partial<Record<HomeSectionId, HomeSectionId>> = {
  pockets: "stats",
};

/**
 * Repairs a stored layout: drops unknown and duplicate ids, coerces `visible` to a boolean and adds any
 * section the stored value does not mention, visible, at the end (or after its `INSERT_AFTER` anchor).
 */
export function normalizeHomeLayout(value: unknown): HomeSectionPref[] {
  const out: HomeSectionPref[] = [];
  const seen = new Set<HomeSectionId>();
  if (Array.isArray(value)) {
    for (const entry of value) {
      const id = (entry as { id?: unknown } | null)?.id;
      if (!isSectionId(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        visible: (entry as { visible?: unknown }).visible !== false,
      });
    }
  }
  for (const id of HOME_SECTION_IDS) {
    if (seen.has(id)) continue;
    const anchor = INSERT_AFTER[id];
    const at = anchor ? out.findIndex((s) => s.id === anchor) : -1;
    if (at >= 0) out.splice(at + 1, 0, { id, visible: true });
    else out.push({ id, visible: true });
  }
  return out;
}

/** Moves the section at `index` by `delta` places; out-of-range moves return the layout unchanged. */
export function moveHomeSection(
  layout: readonly HomeSectionPref[],
  index: number,
  delta: -1 | 1,
): HomeSectionPref[] {
  const target = index + delta;
  if (
    index < 0 ||
    index >= layout.length ||
    target < 0 ||
    target >= layout.length
  )
    return [...layout];
  const next = [...layout];
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item as HomeSectionPref);
  return next;
}

export function setHomeSectionVisible(
  layout: readonly HomeSectionPref[],
  id: HomeSectionId,
  visible: boolean,
): HomeSectionPref[] {
  return layout.map((s) => (s.id === id ? { ...s, visible } : s));
}

export function isDefaultHomeLayout(
  layout: readonly HomeSectionPref[],
): boolean {
  return (
    layout.length === DEFAULT_HOME_LAYOUT.length &&
    layout.every((s, i) => s.id === DEFAULT_HOME_LAYOUT[i]?.id && s.visible)
  );
}
