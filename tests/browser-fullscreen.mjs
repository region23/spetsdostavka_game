import { chromium } from "playwright";
import { expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
mkdirSync("output", { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const url = process.env.GAME_URL || "http://127.0.0.1:5173/";
const errors = [];
async function open(init) {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  page.on("pageerror", e => errors.push(e.message));
  if (init) await page.addInitScript(init);
  await page.goto(url);
  await page.locator('[data-action="start"]').waitFor();
  return page;
}
try {
  const page = await open();
  // Real browser Fullscreen API, entered through a user gesture.
  await page.locator('[data-action="fullscreen"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await expect(page.locator('[data-action="fullscreen"]')).toHaveAttribute("aria-label", "Выйти из полного экрана");
  await page.locator('[data-action="fullscreen"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.locator('[data-action="start"]').click();
  await page.locator('[data-action="intro-skip"]').click();
  await page.locator('[data-action="accept"]').click();
  await page.locator('[data-action="fullscreen"]').click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.locator('[data-action="fullscreen"]').click();
  await expect(page.locator('[data-action="resume"]')).toBeVisible();

  // Capability fixtures exercise the iPhone branch, not a claim of iOS testing.
  const iphone = await open(() => {
    Object.defineProperty(document, "fullscreenEnabled", { get: () => false });
    Object.defineProperty(navigator, "userAgent", { get: () => "iPhone" });
    Element.prototype.requestFullscreen = undefined;
  });
  await iphone.locator('[data-action="fullscreen"]').click();
  await expect(iphone.locator(".fullscreen-help")).toContainText("На экран Домой");
  await iphone.screenshot({ path: "output/fullscreen-iphone-help.png" });
  await iphone.locator('[data-action="fullscreen-back"]').click();
  await expect(iphone.locator('[data-action="start"]')).toBeVisible();
  const manifestURL = await iphone.locator('link[rel="manifest"]').evaluate(el => el.href);
  const response = await iphone.request.get(manifestURL);
  assert.equal(response.status(), 200);
  const manifest = await response.json();
  assert.equal(manifest.display, "fullscreen");
  assert.equal(new URL(manifest.start_url, manifestURL).pathname, new URL(url).pathname);
  for (const icon of manifest.icons) {
    const r = await iphone.request.get(new URL(icon.src, manifestURL).href);
    assert.equal(r.status(), 200);
    assert.match(r.headers()["content-type"], /image\/png/);
  }
  const appleIcon = await iphone.locator('link[rel="apple-touch-icon"]').evaluate(el => el.href);
  assert.equal((await iphone.request.get(appleIcon)).status(), 200);
  const standalone = await open(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
  assert.equal(await standalone.locator('[data-action="fullscreen"]').count(), 0);
  const denied = await open(() => {
    Element.prototype.requestFullscreen = () => Promise.reject(new Error("Denied"));
  });
  await denied.locator('[data-action="fullscreen"]').click();
  await expect(denied.locator(".fullscreen-help")).toContainText("не разрешил");
  assert.deepEqual(errors, []);
  console.log("PASS real fullscreen entry/exit, exit pauses play, unavailable/denied API, iOS help, standalone launch metadata and icon URLs");
} finally { await browser.close(); }
