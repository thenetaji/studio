import {
  hitSankeyNode,
  linkOutline,
  sankeyLayout,
  spreadLabels,
} from "./sankey";
import {
  divergingDomain,
  divergingLength,
  sparkPoints,
  stackSeries,
} from "./series";

const nodes = [
  { key: "salary", column: 0 },
  { key: "freelance", column: 0 },
  { key: "hub", column: 1 },
  { key: "rent", column: 2 },
  { key: "food", column: 2 },
  { key: "saved", column: 2 },
];
const links = [
  { source: "salary", target: "hub", value: 800 },
  { source: "freelance", target: "hub", value: 200 },
  { source: "hub", target: "rent", value: 500 },
  { source: "hub", target: "food", value: 300 },
  { source: "hub", target: "saved", value: 200 },
];

describe("sankeyLayout", () => {
  const layout = sankeyLayout(nodes, links, {
    width: 300,
    height: 220,
    nodeWidth: 6,
    nodeGap: 10,
  });
  const node = (key: string) => layout.nodes.find((n) => n.key === key)!;

  it("uses one scale so a band is equally thick at both ends", () => {
    for (const l of layout.links) {
      expect(l.sy1 - l.sy0).toBeCloseTo(l.width);
      expect(l.ty1 - l.ty0).toBeCloseTo(l.width);
      expect(l.width).toBeCloseTo(l.value * layout.scale);
    }
  });

  it("fits the tallest column exactly and centres the others", () => {
    // Column 2 has three nodes and two gaps: it sets the scale.
    expect(node("rent").y0).toBeCloseTo(0);
    expect(node("saved").y1).toBeCloseTo(220);
    const hub = node("hub");
    expect((hub.y0 + hub.y1) / 2).toBeCloseTo(110);
    expect(hub.y1 - hub.y0).toBeCloseTo(1000 * layout.scale);
  });

  it("keeps node order and spreads columns across the width", () => {
    expect(node("salary").y0).toBeLessThan(node("freelance").y0);
    expect(node("salary").x0).toBe(0);
    expect(node("hub").x0).toBeCloseTo(147);
    expect(node("rent").x1).toBeCloseTo(300);
  });

  it("stacks bands out of the hub in target order without overlap", () => {
    const out = layout.links
      .filter((l) => l.source === "hub")
      .sort((a, b) => a.sy0 - b.sy0);
    expect(out.map((l) => l.target)).toEqual(["rent", "food", "saved"]);
    expect(out[0]!.sy0).toBeCloseTo(node("hub").y0);
    for (let i = 1; i < out.length; i++)
      expect(out[i]!.sy0).toBeCloseTo(out[i - 1]!.sy1);
    expect(out[2]!.sy1).toBeCloseTo(node("hub").y1);
  });

  it("drops empty links and returns nothing for no flow", () => {
    expect(
      sankeyLayout(nodes, [{ source: "salary", target: "hub", value: 0 }], {
        width: 300,
        height: 200,
      }).nodes,
    ).toEqual([]);
    const partial = sankeyLayout(
      nodes,
      [{ source: "salary", target: "hub", value: 10 }],
      { width: 300, height: 200 },
    );
    expect(partial.nodes.map((n) => n.key).sort()).toEqual(["hub", "salary"]);
  });

  it("gives tiny nodes a minimum height and still fits", () => {
    const tiny = sankeyLayout(
      [
        { key: "a", column: 0 },
        { key: "b", column: 1 },
        { key: "c", column: 1 },
      ],
      [
        { source: "a", target: "b", value: 1000 },
        { source: "a", target: "c", value: 1 },
      ],
      { width: 100, height: 100, nodeGap: 10, minNodeHeight: 4 },
    );
    const c = tiny.nodes.find((n) => n.key === "c")!;
    expect(c.y1 - c.y0).toBeCloseTo(4);
    const last = Math.max(...tiny.nodes.map((n) => n.y1));
    expect(last).toBeLessThanOrEqual(100.001);
  });

  it("honours explicit column positions", () => {
    const placed = sankeyLayout(nodes, links, {
      width: 300,
      height: 200,
      columnX: [0, 120, 294],
    });
    expect(placed.nodes.find((n) => n.key === "hub")!.x0).toBe(120);
  });
});

describe("linkOutline", () => {
  it("runs top edge out and bottom edge back with mid-way controls", () => {
    const o = linkOutline({ x0: 0, x1: 100, sy0: 0, sy1: 10, ty0: 50, ty1: 60 });
    expect(o.move).toEqual([0, 0]);
    expect(o.top).toEqual([50, 0, 50, 50, 100, 50]);
    expect(o.down).toEqual([100, 60]);
    expect(o.bottom).toEqual([50, 60, 50, 10, 0, 10]);
  });
});

describe("spreadLabels", () => {
  it("leaves labels that already fit where they are", () => {
    expect(spreadLabels([10, 50, 90], 20, 0, 100)).toEqual([10, 50, 90]);
  });
  it("pushes crowded labels apart in order", () => {
    expect(spreadLabels([50, 52, 54], 20, 0, 200)).toEqual([50, 70, 90]);
  });
  it("pushes back up from the bottom edge", () => {
    expect(spreadLabels([90, 95, 100], 20, 0, 100)).toEqual([60, 80, 100]);
  });
  it("keeps the input order of the result", () => {
    expect(spreadLabels([54, 50], 20, 0, 200)).toEqual([70, 50]);
  });
  it("spreads evenly when there is not enough room", () => {
    expect(spreadLabels([0, 0, 0], 100, 0, 100)).toEqual([0, 50, 100]);
  });
});

describe("hitSankeyNode", () => {
  const boxes = [
    { x0: 0, x1: 6, y0: 0, y1: 40 },
    { x0: 0, x1: 6, y0: 50, y1: 52 },
  ];
  it("finds the nearest node within the slop", () => {
    expect(hitSankeyNode(boxes, 3, 20)).toBe(0);
    expect(hitSankeyNode(boxes, 10, 58)).toBe(1);
    expect(hitSankeyNode(boxes, 3, 43)).toBe(0);
    expect(hitSankeyNode(boxes, 60, 20)).toBe(-1);
  });
});

describe("stackSeries", () => {
  it("builds positives up and negatives down from zero", () => {
    const { bands, min, max } = stackSeries([
      [10, 20],
      [5, -5],
      [-3, 4],
    ]);
    expect(bands[0]).toEqual({ lower: [0, 0], upper: [10, 20] });
    expect(bands[1]).toEqual({ lower: [10, -5], upper: [15, 0] });
    expect(bands[2]).toEqual({ lower: [-3, 20], upper: [0, 24] });
    expect(max).toBe(24);
    expect(min).toBe(-5);
  });
});

describe("sparkPoints", () => {
  it("maps the range onto the box and keeps zero in view", () => {
    const pts = sparkPoints([0, 50, 100], 104, 24, 2);
    expect(pts[0]).toEqual([2, 22]);
    expect(pts[1]).toEqual([52, 12]);
    expect(pts[2]).toEqual([102, 2]);
  });
  it("draws a flat series mid-height", () => {
    expect(sparkPoints([0, 0], 10, 20).map((p) => p[1])).toEqual([10, 10]);
  });
});

describe("divergingDomain", () => {
  it("is the larger side, and zero for no change", () => {
    expect(divergingDomain([-1300, 900])).toBe(1300);
    expect(divergingDomain([0, 0])).toBe(0);
  });
  it("gives non-zero bars a visible floor", () => {
    expect(divergingLength(1, 1000, 100)).toBe(2);
    expect(divergingLength(-500, 1000, 100)).toBe(50);
    expect(divergingLength(0, 1000, 100)).toBe(0);
    expect(divergingLength(5000, 1000, 100)).toBe(100);
  });
});
