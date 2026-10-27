// Generates packages/icons/src/generated/*.ts from the Iconify JSON packs for the curated concept list.
// Run: pnpm icons
// Options:
//   --out <dir>              where the generated TypeScript goes (default packages/icons/src/generated)
//   --tab-icons <app dir>    also rasterise the tab-bar icons into <app dir>/assets/tab-icons and write
//                            <app dir>/src/generated/tab-icons.ts (NativeTabs only takes SF Symbols or images)
//   --tabs a,b,c             concept ids to rasterise (default home,activity,insights,budgets)
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { concepts } from "./icon-concepts.mjs";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const option = (name) => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const outDir = path.resolve(
  option("--out") ?? path.join(root, "src/generated"),
);
const tabAppDir = option("--tab-icons")
  ? path.resolve(option("--tab-icons"))
  : undefined;
fs.mkdirSync(outDir, { recursive: true });
const load = (pkg) => require(`@iconify-json/${pkg}/icons.json`);

const SETS = {
  "phosphor-duotone": {
    pkg: "ph",
    suffix: "-duotone",
    file: "phosphorDuotone",
    strict: true,
  },
  "phosphor-fill": {
    pkg: "ph",
    suffix: "-fill",
    file: "phosphorFill",
    strict: true,
  },
  hugeicons: { pkg: "hugeicons", suffix: "", file: "hugeicons" },
  solar: { pkg: "solar", suffix: "-bold-duotone", file: "solar" },
  lucide: { pkg: "lucide", suffix: "", file: "lucide" },
};

function resolveIcon(data, name) {
  let icon = data.icons[name];
  if (!icon && data.aliases?.[name]) {
    const alias = data.aliases[name];
    const parent = data.icons[alias.parent];
    if (parent) icon = { ...parent, ...alias };
  }
  return icon;
}

// Hand-picked names where the automatic keyword search has no good match.
const OVERRIDES = {
  solar: {
    "arrow-up-right": "arrow-right-up",
    "arrow-down-right": "arrow-right-down",
    pizza: "chef-hat",
    wine: "wineglass",
    beer: "mug",
    cocktail: "wineglass-triangle",
    icecream: "donut-bitten",
    bakery: "donut",
    fruit: "leaf",
    vegetables: "chef-hat-heart",
    seafood: "water-sun",
    basket: "bag-5",
    bicycle: "bicycling",
    parking: "map-point",
    "ev-charging": "electric-refueling",
    ferry: "route",
    "car-repair": "car-battery",
    garden: "trellis",
    tools: "toolbox",
    moving: "delivery",
    dentist: "smile-circle",
    yoga: "meditation",
    boxing: "dumbbells",
    dog: "paw",
    kids: "balloon",
    camping: "bonfire",
    mountains: "hiking",
    shoes: "walking",
    crypto: "wad-of-money",
    loans: "hand-money",
    rupee: "banknote-2",
    pound: "dollar-minimalistic",
    bank: "buildings-3",
    tips: "hand-stars",
    flower: "perfume",
  },
  hugeicons: {
    food: "restaurant-02",
    wine: "bottle-wine",
    "arrow-right": "arrow-right-02",
    "arrow-up": "arrow-up-02",
    "arrow-down": "arrow-down-02",
  },
  lucide: {
    "chevron-down": "chevron-down",
    "chevron-up": "chevron-up",
    "chevron-left": "chevron-left",
    "chevron-right": "chevron-right",
    tea: "cup-soda",
    dentist: "smile",
    basketball: "goal",
    tennis: "volleyball",
  },
};

// Drawn here, not picked from a pack: the Insights tab is an ascending bar chart in every style (like SF
// `chart.bar.fill`), drawn to each pack's grid and stroke so it sits level with the other tab glyphs.
const rect = (x, y, w, h, rx) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}"/>`;
const bars = (rows) => rows.map((b) => rect(...b)).join("");
const phDuoBars = bars([
  [40, 136, 32, 80, 4],
  [112, 88, 32, 128, 4],
  [184, 32, 32, 184, 4],
]);
const CUSTOM = {
  "phosphor-fill": {
    insights: `<g fill="currentColor">${bars([
      [32, 128, 48, 96, 12],
      [104, 80, 48, 144, 12],
      [176, 32, 48, 192, 12],
    ])}</g>`,
  },
  "phosphor-duotone": {
    insights: `<g fill="currentColor"><g opacity=".2">${phDuoBars}</g><g fill="none" stroke="currentColor" stroke-width="16" stroke-linejoin="round">${phDuoBars}</g></g>`,
  },
  hugeicons: {
    insights: `<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">${bars([
      [3.25, 12.25, 4, 8.5, 1],
      [10, 7.75, 4, 13, 1],
      [16.75, 3.25, 4, 17.5, 1],
    ])}</g>`,
  },
  solar: {
    insights: `<g fill="currentColor"><g opacity=".5">${bars([
      [2.5, 12.5, 5, 9, 1.5],
      [9.5, 7.5, 5, 14, 1.5],
    ])}</g>${rect(16.5, 2.5, 5, 19, 1.5)}</g>`,
  },
  lucide: {
    insights: `<g fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">${bars([
      [3, 12, 4, 9, 1],
      [10, 7.5, 4, 13.5, 1],
      [17, 3, 4, 18, 1],
    ])}</g>`,
  },
};

// Pure UI glyphs: Phosphor's duotone/fill variants add a filled square behind them, so use the bold line weight.
const PLAIN_UI = new Set([
  "add",
  "minus",
  "check",
  "close",
  "arrow-right",
  "arrow-up",
  "arrow-down",
  "chevron-down",
  "chevron-up",
  "chevron-left",
  "chevron-right",
  "arrow-up-right",
  "arrow-down-right",
  "drag",
  "more",
  "circle",
  "forward",
]);

function pick(set, data, names, concept) {
  const { suffix, strict } = set;
  if (
    strict &&
    PLAIN_UI.has(concept.id) &&
    resolveIcon(data, `${concept.ph}-bold`)
  )
    return `${concept.ph}-bold`;
  const forced = OVERRIDES[set.key]?.[concept.id];
  if (forced && resolveIcon(data, `${forced}${suffix}`))
    return `${forced}${suffix}`;
  const base = (n) =>
    suffix && n.endsWith(suffix) ? n.slice(0, -suffix.length) : n;
  const all = Object.keys(data.icons).concat(Object.keys(data.aliases ?? {}));
  const wanted = [concept.ph, ...concept.kw];
  for (const w of strict ? [concept.ph] : wanted) {
    const exact = `${w}${suffix}`;
    if (resolveIcon(data, exact)) return exact;
  }
  if (strict) return null;
  for (const w of wanted) {
    const hits = all.filter(
      (n) =>
        n.endsWith(suffix) &&
        (base(n) === w ||
          base(n).startsWith(`${w}-`) ||
          base(n).replace(/-\d+$/, "") === w),
    );
    if (hits.length) return hits.sort((a, b) => a.length - b.length)[0];
  }
  return null;
}

// Trim path precision: icons render at 16-72pt, so 2 decimals on a 24 grid (1 on a 256 grid) is invisible.
function shrink(body, vb) {
  const prec = vb > 100 ? 1 : 2;
  return body.replace(
    / d="([^"]*)"/g,
    (_, d) =>
      ` d="${d.replace(/(?<![\d.])-?\d*\.\d{3,}/g, (n, offset) => {
        const r = String(Number(Number(n).toFixed(prec)));
        return d[offset + n.length] === "." && !r.includes(".") ? `${r} ` : r;
      })}"`,
  );
}

fs.mkdirSync(outDir, { recursive: true });
const report = { missing: [] };
const picks = {};
const bodiesByStyle = {};
for (const [style, setBase] of Object.entries(SETS)) {
  const set = { ...setBase, key: style };
  const data = load(set.pkg);
  const vb = data.width ?? 24;
  const entries = [];
  picks[style] = {};
  bodiesByStyle[style] = {};
  for (const c of concepts) {
    const custom = CUSTOM[style]?.[c.id];
    if (custom) {
      picks[style][c.id] = "(custom)";
      bodiesByStyle[style][c.id] = custom;
      entries.push(`  ${JSON.stringify(c.id)}: ${JSON.stringify(custom)},`);
      continue;
    }
    const name = pick(set, data, null, c);
    if (!name) {
      report.missing.push(`${style}:${c.id}`);
      continue;
    }
    const icon = resolveIcon(data, name);
    if (
      (icon.width ?? vb) !== vb ||
      (icon.height ?? vb) !== vb ||
      icon.rotate ||
      icon.hFlip ||
      icon.vFlip
    ) {
      report.missing.push(`${style}:${c.id} (transformed ${name})`);
      continue;
    }
    picks[style][c.id] = name;
    bodiesByStyle[style][c.id] = shrink(icon.body, vb);
    entries.push(
      `  ${JSON.stringify(c.id)}: ${JSON.stringify(bodiesByStyle[style][c.id])},`,
    );
  }
  const src = `// Generated by packages/icons/scripts/build-icons.mjs from @iconify-json/${set.pkg}. Do not edit.\nexport const viewBox = ${vb};\nexport const bodies: Record<string, string> = {\n${entries.join("\n")}\n};\n`;
  fs.writeFileSync(path.join(outDir, `${set.file}.ts`), src);
}

const live = concepts;
const sfAliases = {};
for (const c of live)
  for (const s of c.sf) if (!(s in sfAliases)) sfAliases[s] = c.id;
const words = (c) =>
  [
    ...new Set(
      [c.id, c.label, c.ph, ...c.kw]
        .join(" ")
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean),
    ),
  ].join(" ");
const meta = live.map(
  (c) =>
    `  { id: ${JSON.stringify(c.id)}, label: ${JSON.stringify(c.label)}, theme: ${JSON.stringify(c.theme)}, sf: ${JSON.stringify(c.sf[0])}, words: ${JSON.stringify(words(c))} },`,
);
const meta_src = `// Generated by packages/icons/scripts/build-icons.mjs. Do not edit.\nexport type ConceptMeta = { id: string; label: string; theme: string; sf: string; words: string };\nexport const conceptMeta: readonly ConceptMeta[] = [\n${meta.join("\n")}\n];\nexport const sfAliases: Record<string, string> = ${JSON.stringify(sfAliases, null, 1)};\n`;
fs.writeFileSync(path.join(outDir, "concepts.ts"), meta_src);
if (process.env.ICON_PICKS)
  fs.writeFileSync(process.env.ICON_PICKS, JSON.stringify(picks, null, 1));
// Tab bar icons: NativeTabs only takes SF Symbols or raster images, so rasterise the tab concepts per style.
// PNGs are template images (alpha only); iOS tints them. Skip with TAB_ICONS=0.
const TABS = (option("--tabs") ?? "home,activity,insights,budgets").split(",");
const tabDir = tabAppDir ? path.join(tabAppDir, "assets/tab-icons") : "";
if (tabAppDir && process.env.TAB_ICONS !== "0") {
  try {
    const { chromium } = require("playwright");
    fs.mkdirSync(tabDir, { recursive: true });
    const browser = await chromium.launch();
    for (const [style, set] of Object.entries(SETS)) {
      const data = load(set.pkg);
      const vb = data.width ?? 24;
      for (const id of TABS) {
        const body = bodiesByStyle[style][id];
        for (const scale of [2, 3]) {
          const page = await browser.newPage({
            viewport: { width: 25, height: 25 },
            deviceScaleFactor: scale,
          });
          await page.setContent(
            `<body style="margin:0;background:transparent"><svg xmlns="http://www.w3.org/2000/svg" width="25" height="25" viewBox="0 0 ${vb} ${vb}" style="color:#000">${body}</svg></body>`,
          );
          await page.screenshot({
            path: path.join(tabDir, `${style}-${id}@${scale}x.png`),
            omitBackground: true,
          });
          await page.close();
        }
      }
    }
    await browser.close();
    const byStyle = Object.keys(SETS).map((style) => {
      const rows = TABS.map(
        (id) =>
          `    ${JSON.stringify(id)}: require('../../assets/tab-icons/${style}-${id}.png') as number,`,
      ).join("\n");
      return `  ${JSON.stringify(style)}: {\n${rows}\n  },`;
    });
    fs.mkdirSync(path.join(tabAppDir, "src/generated"), { recursive: true });
    fs.writeFileSync(
      path.join(tabAppDir, "src/generated/tab-icons.ts"),
      `// Generated by packages/icons/scripts/build-icons.mjs. Do not edit.\nexport const tabIcons: Record<string, Record<string, number>> = {\n${byStyle.join("\n")}\n};\n`,
    );
  } catch (error) {
    console.warn("tab icons skipped:", error.message);
  }
}

console.log(`${live.length} concepts; missing: ${report.missing.length}`);
for (const m of report.missing) console.log("  ", m);
for (const f of fs.readdirSync(outDir))
  console.log(f, fs.statSync(path.join(outDir, f)).size);
