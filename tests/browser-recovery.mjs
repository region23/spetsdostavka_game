import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    "/Users/pavlenko/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  headless: true,
});
const errors = [];
async function pageFor(init) {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  if (init) await page.addInitScript(init);
  await page.goto("http://127.0.0.1:5173/");
  return page;
}
async function start(page) {
  await page.locator("[data-action=start]").waitFor();
  await page.locator("[data-action=start]").click();
  if (await page.locator("[data-action=intro-skip]").isVisible())
    await page.locator("[data-action=intro-skip]").click();
  await page.locator("[data-action=accept]").click();
}
try {
  const page = await pageFor();
  await start(page);
  await page.clock.install();
  await page.clock.runFor(100);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  assert.equal(await page.evaluate(() => window.__spets.mode), "pause");
  const before = await page.evaluate(() => window.__spets);
  await page.clock.runFor(20000);
  assert.deepEqual(await page.evaluate(() => window.__spets), before);
  await page.locator("[data-action=resume]").click();
  await page.keyboard.press("r");
  assert.equal(await page.evaluate(() => window.__spets.mode), "restart");
  await page.locator("[data-action=confirm-restart]").click();
  await page.keyboard.press("Escape");
  await page.locator("[data-action=settings]").click();
  await page.locator("[data-bind=seal]").click();
  await page.keyboard.press("g");
  assert.match(await page.locator("[data-bind=seal]").innerText(), /G/);
  await page.locator("[data-setting=master]").fill("0");
  await page.locator("[data-action=back]").click();
  await page.locator("[data-action=help]").click();
  await page.locator("[data-action=skip]").click();
  assert.equal(await page.evaluate(() => window.__spets.state.room), 1);
  assert.equal(
    await page.evaluate(() => window.__spets.state.parcel.carried),
    true,
  );
  await page.keyboard.down("g");
  await page.clock.runFor(1500);
  assert.equal(
    await page.evaluate(() => window.__spets.state.parcel.open),
    true,
  );
  await page.keyboard.up("g");
  await page.keyboard.press("Escape");
  await page.reload();
  await page.clock.runFor(2000);
  await page.locator("[data-action=continue]").waitFor();
  await page.locator("[data-action=continue]").click();
  assert.equal(await page.evaluate(() => window.__spets.state.room), 1);
  assert.equal(
    await page.evaluate(() => window.__spets.state.parcel.carried),
    true,
  );
  assert.equal(
    await page.evaluate(() => window.__spets.state.parcel.open),
    false,
  );
  await page.close();
  console.log(
    "PASS pause / restart / skip / remap / seal repeat suppression / checkpoint reload",
  );
  const corrupt = await pageFor(() => {
    localStorage.setItem("spets-save", "{invalid");
    localStorage.setItem("spets-settings", JSON.stringify({ music: 0.15 }));
  });
  await corrupt.locator("[data-action=start]").waitFor();
  await corrupt.locator("[data-action=settings]").click();
  assert.equal(
    await corrupt.locator("[data-setting=music]").inputValue(),
    "0.15",
  );
  await corrupt.close();
  console.log("PASS corrupt save preserves independent settings");
  const denied = await pageFor(() => {
    Storage.prototype.getItem = () => {
      throw new DOMException("denied", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("denied", "SecurityError");
    };
    Object.defineProperty(window, "AudioContext", {
      value: class {
        constructor() {
          throw Error("blocked audio");
        }
      },
    });
  });
  await start(denied);
  assert.equal(await denied.evaluate(() => window.__spets.mode), "game");
  assert.match(
    await denied.locator("#toast").innerText(),
    /только до закрытия/,
  );
  await denied.close();
  console.log("PASS denied storage and blocked audio do not block game");
  const missing = await browser.newPage();
  await missing.route("**/assets/post-office.png", (route) => route.abort());
  await missing.goto("http://127.0.0.1:5173/");
  await missing.locator("[data-action=reload]").waitFor();
  assert.match(
    await missing.locator("body").innerText(),
    /Не удалось загрузить/,
  );
  await missing.close();
  console.log("PASS missing required image offers reload");
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
