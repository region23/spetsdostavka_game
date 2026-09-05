// Raster exports of the existing postal emblem for home-screen launchers.
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
try {
  mkdirSync("public/icons", { recursive: true });
  const page = await browser.newPage({ deviceScaleFactor: 1 });
  await page.setContent(`<style>body{margin:0;background:#263e3c}svg{width:100vw;height:100vh}</style>${readFileSync("public/favicon.svg", "utf8")}`);
  for (const size of [180, 192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.screenshot({ path: `public/icons/app-${size}.png` });
  }
} finally { await browser.close(); }
