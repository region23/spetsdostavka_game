import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
mkdirSync("output", { recursive: true });
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
  await click("about");
  assert.equal(await page.locator(".project-links a").count(), 2);
  await page.screenshot({ path: "output/about-links.png" });
  await page.setViewportSize({ width: 960, height: 720 });
  await page.screenshot({ path: "output/about-links-960.png" });
  await click("menu");
  await page.setViewportSize({ width: 1280, height: 720 });
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
  // Inspect all production frames at 2× display size against light and dark.
  const atlasCheck = await page.evaluate(async () => {
    const img = new Image(); img.src = "/assets/courier-hd.png"; await img.decode();
    const atlas = await (await fetch("/assets/courier-hd.json")).json();
    const canvas = document.createElement("canvas"); canvas.width = 1536; canvas.height = 560;
    const ctx = canvas.getContext("2d");
    const source = document.createElement("canvas"); source.width = img.width; source.height = img.height;
    const sourceCtx = source.getContext("2d"); sourceCtx.drawImage(img, 0, 0);
    const frames = Object.entries(atlas.frames);
    const checks = frames.map(([name, { frame: f }]) => {
      const rgba = sourceCtx.getImageData(f.x, f.y, f.w, f.h).data;
      let pixels = 0, edgePixels = 0, coloredFringe = 0, whiteFringe = 0;
      for (let i = 0; i < rgba.length; i += 4) {
        if (!rgba[i + 3]) continue;
        pixels++;
        if (rgba[i + 3] < 240) {
          edgePixels++;
          if (rgba[i + 1] - Math.max(rgba[i], rgba[i + 2]) > 30) coloredFringe++;
          if (Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) > 220) whiteFringe++;
        }
      }
      return { name, width: f.w, height: f.h, pixels, edgePixels, coloredFringe, whiteFringe };
    });
    ["#eee8d8", "#15242a"].forEach((background, row) => {
      ctx.fillStyle = background; ctx.fillRect(0, row * 280, 1536, 280);
      frames.forEach(([name, { frame: f }], i) => {
        ctx.drawImage(img, f.x, f.y, f.w, f.h, i * 192, row * 280 + 20, 192, 240);
        ctx.fillStyle = row ? "#eee8d8" : "#253b3c"; ctx.fillText(name, i * 192 + 70, row * 280 + 275);
      });
    });
    document.body.replaceChildren(canvas); canvas.id = "atlas-check";
    return checks;
  });
  await page.setViewportSize({ width: 1536, height: 560 });
  await page.locator("#atlas-check").screenshot({ path: "output/courier-frames.png" });
  for (const frame of atlasCheck) {
    assert.equal(frame.width, 288);
    assert.equal(frame.height, 360);
    assert.ok(frame.pixels > 10000 && frame.edgePixels > 100, JSON.stringify(frame));
    assert.equal(frame.coloredFringe, 0, JSON.stringify(frame));
    // Allow isolated white shirt/cuff pixels; a matte halo lights a large
    // fraction of the silhouette, not a single clothing detail.
    assert.ok(frame.whiteFringe / frame.edgePixels < 0.005, JSON.stringify(frame));
  }
  assert.deepEqual(errors, []);
  console.log("PASS menu cleanup, distinct story art, layered motion, pause, reduced motion, sprite frame render");
} finally {
  await browser.close();
}
