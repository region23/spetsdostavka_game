import { chromium } from "playwright";
import assert from "node:assert/strict";
import { touchDriver } from "./touch-driver.mjs";
const mobile = process.env.TOUCH === "1";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage(mobile
  ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }
  : { viewport: { width: 1280, height: 720 } });
const touch = mobile ? await touchDriver(page) : null;
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", response => {
  if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
});
try {
  await page.goto(process.env.GAME_URL || "http://127.0.0.1:4173/");
  await page.locator("[data-action=start]").waitFor();
  assert.equal(await page.evaluate(() => typeof window.__spets), "undefined");
  await page.locator("[data-action=about]").click();
  for (const url of ["https://t.me/pavlenkodev", "https://github.com/region23/spetsdostavka_game"]) {
    const link = page.locator(`.project-links a[href="${url}"]`);
    assert.ok(await link.isVisible());
    assert.equal(await link.getAttribute("target"), "_blank");
    assert.match(await link.getAttribute("rel"), /noopener/);
  }
  await page.screenshot({ path: "output/production-about.png" });
  await page.locator("[data-action=menu]").click();
  await page.clock.install();
  await page.locator("[data-action=start]").click();
  if (await page.locator("[data-action=intro-next]").isVisible()) {
    for (let i = 0; i < 3; i++) {
      await page.locator(".intro-art img").evaluate(img => img.decode());
      await page.locator("[data-action=intro-next]").click();
    }
  }
  await page.locator("[data-action=accept]").click();
  for (let i = 0; i < 5; i++) {
    if (mobile) await page.locator("[data-action=pause]").tap();
    else await page.keyboard.press("Escape");
    await page.locator("[data-action=help]").click();
    await page.locator("[data-action=skip]").click();
    await page.clock.runFor(100);
  }
  assert.equal(await page.locator("#room-title").innerText(), "Малый зал");
  if (touch) await touch.input(["right"]);
  else await page.keyboard.down("d");
  for (let i = 0; i < 65; i++) {
    await page.clock.runFor(100);
    if ((await page.locator("#context").innerText()).includes("Установить"))
      break;
  }
  if (touch) { await touch.input([]); await touch.input(["interact"]); }
  else { await page.keyboard.up("d"); await page.keyboard.press("e"); }
  await page.clock.runFor(12000);
  await page.locator(".receipt").waitFor();
  await page.screenshot({ path: "output/production-receipt.png" });
  if (mobile) for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    await page.screenshot({ path: `output/mobile-production-receipt-${viewport.width}.png` });
    const title = await page.locator(".receipt h2").boundingBox();
    const stamp = await page.locator(".receipt-stamp").boundingBox();
    assert.ok(stamp.y >= title.y + title.height || stamp.x >= title.x + title.width, "Receipt stamp overlaps heading on phone");
  }
  assert.deepEqual(errors, []);
  console.log(
    `PASS ${mobile ? "touch" : "desktop"} production build: assets, menus, help, delivery, receipt, no debug API. Browser:`,
    browser.version(),
  );
} finally {
  await browser.close();
}
