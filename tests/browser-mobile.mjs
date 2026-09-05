import { chromium } from "playwright";
import { expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { touchDriver } from "./touch-driver.mjs";
mkdirSync("output", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const tap = action => page.locator(`[data-action="${action}"]`).tap();
const state = () => page.evaluate(() => window.__spets);
const touch = await touchDriver(page);
const shot = name => page.screenshot({ path: `output/mobile-${name}.png` });
async function checkControls() {
  await expect.poll(async () => {
    const parent = await page.locator("#game").boundingBox();
    const canvas = await page.locator("#game canvas").boundingBox();
    const scale = Math.min(parent.width / 1280, parent.height / 640);
    return Math.abs(canvas.width - 1280 * scale) + Math.abs(canvas.height - 640 * scale);
  }).toBeLessThan(2);
  const world = await page.locator("#game canvas").boundingBox();
  const viewport = page.viewportSize();
  for (const button of await page.locator("[data-control]").all()) {
    const b = await button.boundingBox();
    assert.ok(b.width >= 44 && b.height >= 44);
    assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width && b.y + b.height <= viewport.height);
    assert.ok(b.x + b.width <= world.x || b.x >= world.x + world.width || b.y >= world.y + world.height || b.y + b.height <= world.y,
      `Button overlaps game: ${await button.getAttribute("data-control")}`);
  }
  const footer = await page.locator(".hud-bottom").boundingBox();
  assert.ok(footer.y >= world.y + world.height - 1, `Messages must stay below the world: ${JSON.stringify({ viewport, world, footer })}`);
  assert.ok(await page.locator("#subtitle").evaluate(el => el.scrollHeight <= el.parentElement.clientHeight));
}
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.locator("[data-action=start]").waitFor();
  assert.equal(await page.locator("body").getAttribute("data-touch"), "true");
  await shot("menu-portrait");
  await tap("about");
  assert.equal(await page.locator(".project-links a").count(), 2);
  await shot("about-portrait");
  await tap("menu");
  await tap("settings");
  assert.equal(await page.locator(".keyboard-settings").getAttribute("open"), null);
  await page.locator('[data-setting="subtitles"]').uncheck();
  await page.locator('[data-setting="subtitles"]').check();
  await tap("back");
  await tap("start");
  for (let i = 0; i < 3; i++) {
    await page.locator(".intro-art img").evaluate(img => img.decode());
    await shot(`intro-${i + 1}`);
    await tap("intro-next");
  }
  assert.match(await page.locator(".rule-note").innerText(), /кнопкой Пломба/);
  await tap("accept");
  await page.clock.install();
  await page.clock.runFor(100);
  await checkControls();
  await shot("game-portrait");
  await page.setViewportSize({ width: 844, height: 390 });
  await page.clock.runFor(100);
  await expect.poll(async () => (await state()).mode).toBe("pause");
  await tap("resume");
  await page.clock.runFor(150);
  await checkControls();
  await shot("game-landscape");

  // Keep movement while a second finger jumps, then release only that finger.
  await touch.input(["right"]); await page.clock.runFor(200);
  await touch.input(["right", "jump"]); await page.clock.runFor(100);
  assert.ok((await state()).state.player.y < 600);
  await touch.input(["right"]); await page.clock.runFor(100);
  assert.ok((await state()).state.player.vx > 0);
  assert.equal(await page.locator('[data-control="jump"]').evaluate(el => el.classList.contains("held")), false);
  await touch.cancel(); await page.clock.runFor(300);
  assert.equal(await page.locator("[data-control].held").count(), 0);
  assert.equal((await state()).state.player.vx, 0);

  // Use the normal help menu to inspect parcel actions in a separate run.
  await tap("pause"); await tap("help"); await tap("skip");
  await page.clock.runFor(100);
  const wasOpen = (await state()).state.parcel.open;
  await touch.input(["seal"]); await page.clock.runFor(1000);
  assert.equal((await state()).state.parcel.open, !wasOpen, "Holding seal toggles once");
  await touch.input([]);
  await touch.input(["interact"]); await page.clock.runFor(700);
  assert.equal((await state()).state.parcel.carried, false, "Holding parcel does not pick it up again");
  await touch.input([]);

  // Rotation during an active press cancels it and preserves the checkpoint.
  await touch.input(["right"]); await page.clock.runFor(50);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(100);
  await expect.poll(async () => (await state()).mode).toBe("pause");
  const elapsed = (await state()).elapsed;
  await touch.cancel(); await page.clock.runFor(500);
  assert.equal((await state()).elapsed, elapsed);
  await tap("resume"); await page.clock.runFor(200);
  assert.equal((await state()).state.player.vx, 0);
  await tap("pause");
  await page.reload(); await page.clock.runFor(1800);
  await tap("continue"); await page.clock.runFor(150);
  assert.equal((await state()).state.room, 1);
  assert.equal(await page.locator("[data-control].held").count(), 0);

  for (const viewport of [{ width: 320, height: 568 }, { width: 667, height: 375 }, { width: 844, height: 390 }]) {
    const before = page.viewportSize();
    await page.setViewportSize(viewport); await page.clock.runFor(100);
    if ((before.width < before.height) !== (viewport.width < viewport.height))
      await expect.poll(async () => (await state()).mode).toBe("pause");
    if ((await state()).mode === "pause") await tap("resume");
    await page.clock.runFor(100);
    await checkControls();
    await shot(`game-${viewport.width}`);
  }
  await page.addStyleTag({ content: ":root { --safe-left: 44px; --safe-right: 20px; --safe-bottom: 21px; }" });
  await page.clock.runFor(100);
  await checkControls();
  await shot("safe-area");
  await tap("pause"); await tap("menu");
  await page.addStyleTag({ content: ":root { --safe-left: 0px; --safe-right: 0px; --safe-bottom: 0px; }" });
  await page.setViewportSize({ width: 320, height: 568 });
  await expect.poll(async () => page.locator(".menu").evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
  await shot("menu-320");
  await tap("about"); await page.locator(".project-links").scrollIntoViewIfNeeded();
  assert.ok(await page.locator(".project-links").evaluate(el => el.scrollWidth <= el.clientWidth));
  assert.deepEqual(errors, []);
  console.log("PASS phone menus, portrait/landscape, multitouch, cancellation, single actions, rotation pause, saves, small screens and safe areas");
} catch (error) { await shot("failure"); throw error; }
finally { await browser.close(); }
