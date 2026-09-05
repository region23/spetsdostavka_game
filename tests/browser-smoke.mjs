import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath:
    "/Users/pavlenko/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto("http://127.0.0.1:5173/");
await page.locator("[data-action=start]").waitFor();
await page.screenshot({ path: "output/menu.png" });
await page.locator("[data-action=start]").click();
  if (await page.locator("[data-action=intro-skip]").isVisible())
    await page.locator("[data-action=intro-skip]").click();
await page.getByRole("button", { name: "Принять доставку →" }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: "output/game.png" });
console.log(
  JSON.stringify({
    errors,
    state: await page.evaluate(() => window.__spets),
    canvas: await page.locator("canvas").count(),
  }),
);
await browser.close();
