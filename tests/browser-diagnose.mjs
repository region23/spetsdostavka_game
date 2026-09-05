import { chromium } from "playwright";
const browser = await chromium.launch({
  executablePath:
    "/Users/pavlenko/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("ERROR", e.stack));
page.on("console", (m) => console.log(m.type(), m.text()));
await page.goto("http://127.0.0.1:5173/");
await page.waitForTimeout(4000);
console.log(await page.locator("body").innerText());
await page.screenshot({ path: "output/diagnose.png" });
await browser.close();
