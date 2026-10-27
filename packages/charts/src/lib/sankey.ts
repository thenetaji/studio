/** Pure layout for layered flow (Sankey) diagrams: node rectangles, link bands and label placement. */

export interface SankeyNodeInput {
  key: string;
  /** 0 = leftmost column. Nodes keep the order they are given in within a column. */
  column: number;
}

export interface SankeyLinkInput {
  source: string;
  target: string;
  /** Any positive magnitude (minor units); zero or negative links are dropped. */
  value: number;
}

export interface SankeyNode {
  key: string;
  column: number;
  /** max(inflow, outflow). */
  value: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  /** Band thickness in pt. */
  width: number;
  /** Right edge of the source node and left edge of the target node. */
  x0: number;
  x1: number;
  /** Band top and bottom where it leaves the source. */
  sy0: number;
  sy1: number;
  /** Band top and bottom where it enters the target. */
  ty0: number;
  ty1: number;
}

export interface SankeyOptions {
  width: number;
  height: number;
  nodeWidth?: number;
  /** Vertical gap between nodes in one column. */
  nodeGap?: number;
  /** Smallest drawn node, so a 0.5% sliver stays visible and tappable. */
  minNodeHeight?: number;
  /** Left edge of each column's nodes; defaults to spreading the columns evenly across the width. */
  columnX?: readonly number[];
}

export interface SankeyLayout {
  nodes: SankeyNode[];
  links: SankeyLink[];
  /** Points per unit of value. */
  scale: number;
}

const EMPTY: SankeyLayout = { nodes: [], links: [], scale: 0 };

/**
 * Lays out a layered flow: each column's nodes are stacked top to bottom in the given order with `nodeGap` between
 * them and centred vertically; one shared scale makes a band equally thick at both ends. Bands leave a node in the
 * order of their targets and enter in the order of their sources, so nothing crosses within a column pair.
 */
export function sankeyLayout(
  nodesIn: readonly SankeyNodeInput[],
  linksIn: readonly SankeyLinkInput[],
  options: SankeyOptions,
): SankeyLayout {
  const {
    width,
    height,
    nodeWidth = 6,
    nodeGap = 10,
    minNodeHeight = 2,
  } = options;
  const keys = new Set(nodesIn.map((n) => n.key));
  const links = linksIn.filter(
    (l) =>
      l.value > 0 &&
      keys.has(l.source) &&
      keys.has(l.target) &&
      l.source !== l.target,
  );
  if (nodesIn.length === 0 || links.length === 0 || width <= 0 || height <= 0)
    return EMPTY;

  const inflow = new Map<string, number>();
  const outflow = new Map<string, number>();
  for (const l of links) {
    outflow.set(l.source, (outflow.get(l.source) ?? 0) + l.value);
    inflow.set(l.target, (inflow.get(l.target) ?? 0) + l.value);
  }
  const nodes = nodesIn
    .map((n) => ({
      ...n,
      value: Math.max(inflow.get(n.key) ?? 0, outflow.get(n.key) ?? 0),
    }))
    .filter((n) => n.value > 0);
  const columnCount = nodes.reduce((m, n) => Math.max(m, n.column + 1), 0);
  const columns = Array.from({ length: columnCount }, (_, c) =>
    nodes.filter((n) => n.column === c),
  );

  // The largest scale at which every column (gaps and minimum heights included) fits the height.
  const fits = (k: number) =>
    columns.every(
      (col) =>
        col.reduce((s, n) => s + Math.max(n.value * k, minNodeHeight), 0) +
          Math.max(0, col.length - 1) * nodeGap <=
        height + 1e-6,
    );
  let k = Math.min(
    ...columns
      .filter((col) => col.length > 0)
      .map(
        (col) =>
          (height - Math.max(0, col.length - 1) * nodeGap) /
          col.reduce((s, n) => s + n.value, 0),
      ),
  );
  if (!(k > 0)) return EMPTY;
  for (let i = 0; i < 30 && !fits(k); i++) k *= 0.97;

  const columnX =
    options.columnX ??
    Array.from({ length: columnCount }, (_, c) =>
      columnCount <= 1 ? 0 : (c / (columnCount - 1)) * (width - nodeWidth),
    );
  const placed = new Map<string, SankeyNode>();
  for (const col of columns) {
    const heights = col.map((n) => Math.max(n.value * k, minNodeHeight));
    const total =
      heights.reduce((s, h) => s + h, 0) +
      Math.max(0, col.length - 1) * nodeGap;
    let y = (height - total) / 2;
    col.forEach((n, i) => {
      const x0 = columnX[n.column] ?? 0;
      const h = heights[i]!;
      placed.set(n.key, {
        key: n.key,
        column: n.column,
        value: n.value,
        x0,
        x1: x0 + nodeWidth,
        y0: y,
        y1: y + h,
      });
      y += h + nodeGap;
    });
  }

  const order = (key: string) => placed.get(key)?.y0 ?? 0;
  const out = new Map<string, number>();
  const into = new Map<string, number>();
  const start = (node: SankeyNode, flow: number) =>
    node.y0 + (node.y1 - node.y0 - flow * k) / 2;
  const bySource = [...links].sort(
    (a, b) => order(a.target) - order(b.target),
  );
  const sourceY = new Map<SankeyLinkInput, number>();
  for (const l of bySource) {
    const node = placed.get(l.source)!;
    const offset = out.get(l.source) ?? start(node, outflow.get(l.source) ?? 0);
    sourceY.set(l, offset);
    out.set(l.source, offset + l.value * k);
  }
  const byTarget = [...links].sort(
    (a, b) => order(a.source) - order(b.source),
  );
  const result: SankeyLink[] = [];
  for (const l of byTarget) {
    const s = placed.get(l.source)!;
    const t = placed.get(l.target)!;
    const offset = into.get(l.target) ?? start(t, inflow.get(l.target) ?? 0);
    into.set(l.target, offset + l.value * k);
    const sy0 = sourceY.get(l)!;
    const w = l.value * k;
    result.push({
      source: l.source,
      target: l.target,
      value: l.value,
      width: w,
      x0: s.x1,
      x1: t.x0,
      sy0,
      sy1: sy0 + w,
      ty0: offset,
      ty1: offset + w,
    });
  }
  // Draw order: top to bottom at the source, so later (lower) bands sit over earlier ones consistently.
  result.sort((a, b) => a.sy0 - b.sy0 || a.ty0 - b.ty0);
  return { nodes: [...placed.values()], links: result, scale: k };
}

/**
 * The closed outline of a link band as cubic segments: top edge left to right, bottom edge right to left.
 * `curvature` 0.5 puts both control points halfway across, the classic S-shaped ribbon.
 */
export function linkOutline(
  link: Pick<SankeyLink, "x0" | "x1" | "sy0" | "sy1" | "ty0" | "ty1">,
  curvature = 0.5,
): {
  move: readonly [number, number];
  top: readonly [number, number, number, number, number, number];
  down: readonly [number, number];
  bottom: readonly [number, number, number, number, number, number];
} {
  const { x0, x1, sy0, sy1, ty0, ty1 } = link;
  const cx0 = x0 + (x1 - x0) * curvature;
  const cx1 = x1 - (x1 - x0) * curvature;
  return {
    move: [x0, sy0],
    top: [cx0, sy0, cx1, ty0, x1, ty0],
    down: [x1, ty1],
    bottom: [cx1, ty1, cx0, sy1, x0, sy1],
  };
}

/**
 * Vertical label centres that keep `minGap` between neighbours, as close as possible to each `desired` centre,
 * inside [min, max]. Order is preserved (labels never swap). Returns positions in the input order.
 */
export function spreadLabels(
  desired: readonly number[],
  minGap: number,
  min: number,
  max: number,
): number[] {
  const order = desired
    .map((y, i) => ({ y, i }))
    .sort((a, b) => a.y - b.y || a.i - b.i);
  const ys = order.map((o) => Math.min(Math.max(o.y, min), max));
  for (let j = 1; j < ys.length; j++)
    ys[j] = Math.max(ys[j]!, ys[j - 1]! + minGap);
  if (ys.length > 0 && ys[ys.length - 1]! > max) {
    ys[ys.length - 1] = max;
    for (let j = ys.length - 2; j >= 0; j--)
      ys[j] = Math.min(ys[j]!, ys[j + 1]! - minGap);
  }
  // A column too tall for the space: spread evenly instead of piling up at the top.
  if (ys.length > 1 && ys[0]! < min) {
    const step = (max - min) / (ys.length - 1);
    for (let j = 0; j < ys.length; j++) ys[j] = min + step * j;
  }
  const out = new Array<number>(desired.length);
  order.forEach((o, j) => {
    out[o.i] = ys[j]!;
  });
  return out;
}

/** Index of the node whose hit box (node plus `slop` around it, full column band) contains the point, or -1. */
export function hitSankeyNode(
  nodes: readonly Pick<SankeyNode, "x0" | "x1" | "y0" | "y1">[],
  x: number,
  y: number,
  slop = 12,
): number {
  let best = -1;
  let bestDistance = Infinity;
  nodes.forEach((n, i) => {
    if (x < n.x0 - slop || x > n.x1 + slop) return;
    const distance = y < n.y0 ? n.y0 - y : y > n.y1 ? y - n.y1 : 0;
    if (distance <= slop && distance < bestDistance) {
      best = i;
      bestDistance = distance;
    }
  });
  return best;
}
