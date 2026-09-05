import { chromium } from "playwright";
import { expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
mkdirSync("output", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const errors = [];
async function checkDensity(page) {
  const measure = () => page.locator("#game canvas").evaluate(canvas => {
    const rect = canvas.getBoundingClientRect();
    const parent = canvas.parentElement.getBoundingClientRect();
    const fit = Math.min(parent.width / 1280, parent.height / 720);
    return { width: canvas.width, height: canvas.height, cssWidth: rect.width, cssHeight: rect.height,
      expectedWidth: 1280 * fit, expectedHeight: 720 * fit, dpr: devicePixelRatio };
  });
  await expect.poll(async () => {
    await page.clock.runFor(50);
    const d = await measure();
    const target = Math.min(3840, d.expectedWidth * d.dpr);
    return Math.abs(d.width - target) + Math.abs(d.cssWidth - d.expectedWidth) + Math.abs(d.cssHeight - d.expectedHeight);
  }).toBeLessThan(2);
  const d = await measure();
  assert.ok(d.width <= 3840 && d.height <= 2160, "Bound rendering memory to the atlas detail budget");
  console.log(JSON.stringify(d));
}
try {
  for (const [width, height, deviceScaleFactor] of [[1280, 720, 1], [1280, 720, 2], [1920, 1080, 1], [1440, 900, 2], [2560, 1440, 2]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor });
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173/");
    await page.locator("[data-action=start]").waitFor();
    await page.clock.install();
    await page.locator("[data-action=start]").click();
    await page.locator("[data-action=intro-skip]").click();
    await page.locator("[data-action=accept]").click();
    await page.clock.runFor(1500);
    await checkDensity(page);
    const rect = await page.locator("#game canvas").boundingBox(), scale = rect.width / 1280;
    await page.screenshot({ path: `output/courier-screen-${width}-${deviceScaleFactor}x.png`, clip: {
      x: rect.x + 66 * scale, y: rect.y + 474 * scale, width: 120 * scale, height: 150 * scale,
    } });
    if (width === 1280 && deviceScaleFactor === 2) {
      await page.setViewportSize({ width: 960, height: 720 });
      await checkDensity(page);
      const session = await page.context().newCDPSession(page);
      await session.send("Emulation.setDeviceMetricsOverride", { width: 960, height: 720, deviceScaleFactor: 1, mobile: false });
      await checkDensity(page);
      await session.detach();
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  console.log("PASS native desktop pixel density, Retina, large windows, resize, DPR change and bounded buffer");
} finally { await browser.close(); }
