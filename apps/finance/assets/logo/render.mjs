// Renders the logo SVGs from mark.mjs to the PNGs in assets/images with headless Chromium. Run from the repo root:
//   node apps/finance/assets/logo/render.mjs
// Opaque outputs are flattened (no alpha channel): App Store Connect rejects an iOS icon with alpha.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

import {
  androidBackground,
  androidForeground,
  androidMonochrome,
  appIcon,
  appIconDark,
  appIconTinted,
  favicon,
  rupeeAndroidForeground,
  rupeeIcon,
  rupeeIconDark,
  rupeeIconTinted,
} from "./mark.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const images = join(here, "..", "images");

const outputs = [
  { name: "icon", svg: appIcon(), size: 1024, opaque: true },
  { name: "icon-dark", svg: appIconDark(), size: 1024 },
  { name: "icon-tinted", svg: appIconTinted(), size: 1024, opaque: true },
  { name: "android-icon-foreground", svg: androidForeground(), size: 1024 },
  { name: "android-icon-monochrome", svg: androidMonochrome(), size: 1024 },
  {
    name: "android-icon-background",
    svg: androidBackground(),
    size: 1024,
    opaque: true,
  },
  { name: "favicon", svg: favicon(), size: 196, opaque: true },
  { name: "icon-rupee", svg: rupeeIcon(), size: 1024, opaque: true },
  { name: "icon-rupee-dark", svg: rupeeIconDark(), size: 1024 },
  {
    name: "icon-rupee-tinted",
    svg: rupeeIconTinted(),
    size: 1024,
    opaque: true,
  },
  {
    name: "android-icon-rupee-foreground",
    svg: rupeeAndroidForeground(),
    size: 1024,
  },
];

/** Drops the alpha channel with ImageMagick when it is installed; Chromium screenshots are always RGBA. */
function flatten(file) {
  try {
    execFileSync("convert", [
      file,
      "-background",
      "black",
      "-alpha",
      "remove",
      "-alpha",
      "off",
      `PNG24:${file}`,
    ]);
  } catch {
    console.warn(
      `  could not flatten ${file} (ImageMagick missing?); strip its alpha before shipping`,
    );
  }
}

// Playwright's own build when it is downloaded; otherwise CHROMIUM_PATH or a preinstalled Chromium.
const executablePath = [
  chromium.executablePath(),
  process.env.CHROMIUM_PATH,
  "/opt/pw-browsers/chromium",
].find((p) => p && existsSync(p));
const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage();
  for (const out of outputs) {
    writeFileSync(join(here, `${out.name}.svg`), out.svg);
    const file = join(images, `${out.name}.png`);
    await page.setViewportSize({ width: out.size, height: out.size });
    const sized = out.svg.replace(
      'width="1024" height="1024"',
      `width="${out.size}" height="${out.size}"`,
    );
    await page.setContent(
      `<html><body style="margin:0;background:transparent">${sized}</body></html>`,
    );
    await page.screenshot({
      path: file,
      omitBackground: !out.opaque,
      clip: { x: 0, y: 0, width: out.size, height: out.size },
    });
    if (out.opaque) flatten(file);
    console.log(`wrote ${out.name}.svg and ${out.name}.png (${out.size}px)`);
  }
} finally {
  await browser.close();
}
