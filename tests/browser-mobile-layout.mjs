import { chromium } from "playwright";
import { expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
mkdirSync("output", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 852, height: 286 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:5173/");
  await page.locator("[data-action=start]").click();
  await page.locator("[data-action=intro-skip]").click();
  await page.locator("[data-action=accept]").click();
  await page.clock.install();
  await page.clock.runFor(1200);
  for (const [width, height, safe] of [[852, 286, 0], [852, 286, 44], [844, 390, 0], [667, 275, 0], [390, 844, 0], [320, 568, 0]]) {
    await page.setViewportSize({ width, height });
    await page.addStyleTag({ content: `:root { --safe-left: ${safe}px; --safe-right: ${safe}px; }` });
    await page.clock.runFor(100);
    if (await page.locator("[data-action=resume]").isVisible()) await page.locator("[data-action=resume]").click();
    await page.clock.runFor(300);
    await page.screenshot({ path: `output/mobile-layout-${width}-${height}-${safe}.png` });
    const canvas = await page.locator("#game canvas").boundingBox();
    console.log({ width, height, safe, canvas });
    assert.ok(canvas.width >= (width - safe * 2) * 0.98, "The game must fill the available phone width, including with Safari bars open");
    const view = await page.evaluate(() => window.__spets?.view);
    if (view) {
      assert.ok(96 * canvas.width / view.width >= 66, "Do not shrink the courier to fit the entire room");
      assert.ok(view.x >= 0 && view.y >= 0 && view.x + view.width <= 1281 && view.y + view.height <= 641);
    }
    const parent = await page.locator("#game").boundingBox();
    assert.ok(Math.abs(canvas.height - parent.height) < 2, "No letterboxing inside the phone stage");
    const footer = await page.locator(".hud-bottom").boundingBox();
    assert.ok(footer.y >= canvas.y + canvas.height - 1, "Keep text outside the route");
    for (const button of await page.locator("[data-control]").all()) {
      const b = await button.boundingBox();
      assert.ok(b.width >= 44 && b.height >= 44);
      assert.ok(b.x >= safe && b.x + b.width <= width - safe + 1 && b.y + b.height <= height);
      assert.ok(b.y >= canvas.y + canvas.height - 1, "Controls must be below the game");
      assert.ok(b.x + b.width <= footer.x || b.x >= footer.x + footer.width || b.y >= footer.y + footer.height || b.y + b.height <= footer.y, "Controls must not cover text");
    }
    await expect(page.locator("#subtitle")).toBeVisible();
    assert.ok(await page.locator(".hud-info").evaluate(el => el.scrollHeight <= el.clientHeight + 1));
  }
  assert.deepEqual(errors, []);
  console.log("PASS phone stage fills width with browser bars, safe areas, readable controls and unobscured text");
} finally { await browser.close(); }
