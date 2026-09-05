import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const click = action => page.locator(`[data-action=${action}]`).click();
const layers = () => page.evaluate(() => {
  const ctx = document.querySelector("#game canvas").getContext("2d");
  return {
    near: [...ctx.getImageData(500, 85, 240, 24).data],
    far: [...ctx.getImageData(710, 420, 120, 80).data],
  };
});
const displacement = (before, after, width, height) => {
  let best = { shift: 0, error: Infinity };
  for (let shift = -15; shift <= 15; shift++) {
    let error = 0;
    for (let y = 0; y < height; y += 2) for (let x = 16; x < width - 16; x++) {
      for (let channel = 0; channel < 3; channel++) {
        const delta = before[(y * width + x + shift) * 4 + channel] - after[(y * width + x) * 4 + channel];
        error += delta * delta;
      }
    }
    if (error < best.error) best = { shift, error };
  }
  return Math.abs(best.shift);
};
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.locator("[data-action=start]").waitFor();
  const menu = await page.locator(".menu").innerText();
  for (const text of ["КОМПЬЮТЕР", "ПРОСПЕКТ, ГЛАВПОЧТАМТ", "ПЕРВАЯ ДОСТАВКА", "ОТПРАВЛЕНИЕ В МАЛЫЙ ЗАЛ"])
    assert.ok(!menu.includes(text));
  await page.clock.install();
  await click("start");
  for (const name of ["intro-city", "intro-acceptance", "intro-delivery"]) {
    assert.ok((await page.locator(".intro-art img").getAttribute("src")).endsWith(`${name}.png`));
    await page.locator(".intro-art img").evaluate(img => img.decode());
    await page.screenshot({ path: `output/visual-${name}.png` });
    await click("intro-next");
  }
  await click("accept");
  await page.clock.runFor(500);
  const start = await layers();
  await page.screenshot({ path: "output/parallax-left.png" });
  await page.keyboard.down("d");
  await page.clock.runFor(350);
  await page.keyboard.up("d");
  await page.clock.runFor(300);
  const moved = await layers();
  const nearShift = displacement(start.near, moved.near, 240, 24);
  const farShift = displacement(start.far, moved.far, 120, 80);
  assert.ok(nearShift > 0 && farShift > nearShift, `near=${nearShift}, far=${farShift}`);
  await page.screenshot({ path: "output/parallax-moved.png" });
  await page.keyboard.press("Escape");
  const paused = await layers();
  await page.clock.runFor(5000);
  assert.deepEqual(await layers(), paused);
  await click("settings");
  await page.locator('[data-setting="reducedMotion"]').check();
  await click("back");
  await click("resume");
  await page.clock.runFor(100);
  const reduced = await layers();
  await page.keyboard.down("a");
  await page.clock.runFor(200);
  await page.keyboard.up("a");
  await page.clock.runFor(100);
  assert.deepEqual(await layers(), reduced);
  // Render every real atlas frame on a light background, enlarged for inspection.
  await page.evaluate(async () => {
    const img = new Image(); img.src = "/assets/courier-clean.png"; await img.decode();
    const canvas = document.createElement("canvas"); canvas.width = 1536; canvas.height = 280;
    const ctx = canvas.getContext("2d"); ctx.fillStyle = "#eee8d8"; ctx.fillRect(0, 0, 1536, 280);
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 8; i++) {
      ctx.drawImage(img, i * 96, 0, 96, 120, i * 192, 20, 192, 240);
      ctx.fillStyle = "#253b3c"; ctx.fillText(["idle", "run1", "run2", "run3", "jump", "fall", "hang", "interact"][i], i * 192 + 70, 275);
    }
    document.body.replaceChildren(canvas); canvas.id = "atlas-check";
  });
  await page.locator("#atlas-check").screenshot({ path: "output/courier-frames.png" });
  assert.deepEqual(errors, []);
  console.log("PASS menu cleanup, distinct story art, layered motion, pause, reduced motion, sprite frame render");
} finally {
  await browser.close();
}
