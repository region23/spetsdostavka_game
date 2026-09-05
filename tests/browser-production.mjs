import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
    await page.keyboard.press("Escape");
    await page.locator("[data-action=help]").click();
    await page.locator("[data-action=skip]").click();
    await page.clock.runFor(100);
  }
  assert.equal(await page.locator("#room-title").innerText(), "Малый зал");
  await page.keyboard.down("d");
  for (let i = 0; i < 65; i++) {
    await page.clock.runFor(100);
    if ((await page.locator("#context").innerText()).includes("Установить"))
      break;
  }
  await page.keyboard.up("d");
  await page.keyboard.press("e");
  await page.clock.runFor(12000);
  await page.locator(".receipt").waitFor();
  await page.screenshot({ path: "output/production-receipt.png" });
  assert.deepEqual(errors, []);
  console.log(
    "PASS production build: assets, menus, help, delivery, receipt, no debug API. Browser:",
    browser.version(),
  );
} finally {
  await browser.close();
}
