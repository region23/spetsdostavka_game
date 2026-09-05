import { chromium } from "playwright";
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROMIUM_PATH ||
    "/Users/pavlenko/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let keys = new Set();
let state;
const read = async () => {
  state = await page.evaluate(() => window.__spets.state);
  return state;
};
async function input(newKeys = []) {
  const next = new Set(newKeys);
  for (const k of keys) if (!next.has(k)) await page.keyboard.up(k);
  for (const k of next) if (!keys.has(k)) await page.keyboard.down(k);
  keys = next;
}
async function tick(newKeys = []) {
  await input(newKeys);
  await page.clock.runFor(50);
  await read();
  if (await page.evaluate(() => window.__spets.state.player.y > 780))
    throw Error("Fell");
}
async function until(predicate, newKeys = [], limit = 500) {
  for (let i = 0; i < limit; i++) {
    await read();
    if (predicate(state)) return;
    await tick(newKeys);
  }
  throw Error("Timeout " + JSON.stringify(state));
}
async function move(x) {
  await read();
  const right = x > state.player.x;
  await until(
    (s) => (right ? s.player.x >= x - 4 : s.player.x <= x + 4),
    [right ? "d" : "a"],
  );
}
async function stop() {
  await until((s) => Math.abs(s.player.vx) < 1, [], 30);
}
async function jumpTo(x) {
  await read();
  const key = x > state.player.x ? "d" : "a";
  await tick(["Space", key]);
  await until((s) => s.player.grounded || s.player.hang, [key], 100);
  if (state.player.hang) await tick(["Space"]);
  await stop();
}
async function exit() {
  await read();
  const r = state.room;
  await until((s) => s.room !== r, ["d"]);
  await stop();
  await page.screenshot({ path: `output/room-${state.room + 1}.png` });
  console.log("entered", state.room);
}
async function liftBoard(index, x, edge) {
  if (state.parcel.open) await tick(["f"]);
  await move(edge);
  await stop();
  await until((s) => s.machines[index].py > 560);
  await jumpTo(x);
}
try {
  await page.goto("http://127.0.0.1:5173/");
  await page.locator("[data-action=start]").waitFor({ timeout: 30000 });
  await page.clock.install();
  await page.screenshot({ path: "output/menu.png" });
  await page.locator("[data-action=start]").click();
  if (await page.locator("[data-action=intro-skip]").isVisible())
    await page.locator("[data-action=intro-skip]").click();
  await page.locator("[data-action=accept]").click();
  await tick();
  await page.screenshot({ path: "output/game.png" });
  await move(215);
  await jumpTo(380);
  await move(425);
  await stop();
  await tick(["e"]);
  assert.equal(state.parcel.carried, true);
  await move(630);
  await tick(["f"]);
  await exit();
  await move(505);
  await stop();
  if (state.parcel.open) await tick(["f"]);
  await until((s) => s.machines[0].py + s.machines[0].h < 497);
  await tick(["f"]);
  await page.screenshot({ path: "output/press-frozen.png" });
  await exit();
  await liftBoard(0, 505, 365);
  await until((s) => s.machines[0].py < 391);
  await tick(["f"]);
  await move(565);
  await jumpTo(710);
  await exit();
  if (state.parcel.open) await tick(["f"]);
  await move(285);
  await jumpTo(505);
  await move(500);
  await stop();
  if (state.player.hang) await tick(["s"]);
  await until((s) => s.player.grounded && s.player.y > 535);
  await until((s) => s.machines[1].py < 340);
  await tick(["f"]);
  await tick(["e"]);
  assert.equal(state.parcel.carried, false);
  await page.screenshot({ path: "output/transfer.png" });
  await move(490);
  await jumpTo(400);
  await stop();
  await until((s) => s.player.grounded);
  await until((s) => s.machines[0].py > 560);
  await move(405);
  await until((s) => s.player.support === "bypass");
  await until((s) => s.machines[0].py < 400);
  await move(465);
  await jumpTo(610);
  await move(705);
  await jumpTo(920);
  await move(868);
  await stop();
  await tick(["e"]);
  assert.equal(state.parcel.carried, true);
  await exit();
  if (state.parcel.open) await tick(["f"]);
  await move(300);
  await stop();
  await until((s) => s.machines[0].px >= 425 && s.machines[0].px <= 440);
  await tick(["f"]);
  await jumpTo(500);
  await move(state.machines[0].px + 120);
  await jumpTo(730);
  await liftBoard(1, 975, 842);
  await until((s) => s.machines[1].py < 378);
  await tick(["f"]);
  await move(1010);
  await jumpTo(1140);
  if (state.room === 4) await exit();
  await move(1085);
  await stop();
  await tick(["e"]);
  assert.equal(state.completed, true);
  await page.clock.runFor(650);
  await page.screenshot({ path: "output/ending.png" });
  await input([]);
  await page.clock.runFor(11000);
  assert.equal(await page.evaluate(() => window.__spets.mode), "receipt");
  await page.screenshot({ path: "output/receipt.png" });
  await page.reload();
  await page.clock.runFor(2000);
  await page.locator("[data-action=start]").waitFor();
  assert.match(
    await page.locator("[data-action=start]").innerText(),
    /Повторить/,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS: keyboard route, all six rooms, ending, persisted completion. Browser:",
    browser.version(),
  );
} catch (e) {
  await page.screenshot({ path: "output/route-failure.png" });
  console.log("ERRORS", errors);
  throw e;
} finally {
  await browser.close();
}
