import { Simulation, type Input } from "../src/simulation";
import { mkdirSync, writeFileSync } from "node:fs";
const s = new Simulation();
const replay: Input[] = [];
const tick = (input: Input = {}) => {
  s.step(input);
  replay.push(input);
  s.events = [];
  if (s.deathDelay > 0)
    throw Error(
      "Death " +
        JSON.stringify({ room: s.roomIndex, p: s.player, m: s.machines }),
    );
};
function until(f: () => boolean, input: Input = {}, limit = 1200) {
  for (let i = 0; i < limit; i++) {
    if (f()) return;
    tick(input);
  }
  throw Error(
    "Timeout " +
      JSON.stringify({ room: s.roomIndex, p: s.player, m: s.machines }),
  );
}
const move = (x: number) =>
  until(() => (x > s.player.x ? s.player.x >= x - 4 : s.player.x <= x + 4), {
    [x > s.player.x ? "right" : "left"]: true,
  });
function stop() {
  until(() => Math.abs(s.player.vx) < 1, {}, 60);
}
function jumpTo(x: number) {
  const direction = x > s.player.x ? "right" : "left";
  tick({ jump: true, [direction]: true });
  until(() => s.player.grounded || !!s.player.hang, { [direction]: true }, 150);
  if (s.player.hang) tick({ jump: true });
  stop();
}
function exit() {
  const r = s.roomIndex;
  until(() => s.roomIndex !== r, { right: true });
  stop();
  console.log("entered", s.roomIndex, "at", Math.round(s.elapsed));
}
move(215);
jumpTo(380);
move(425);
stop();
tick({ interact: true });
move(630);
tick({ seal: true });
exit();
move(505);
stop();
if (s.parcel.open) tick({ seal: true });
until(() => s.machines[0].py + s.machines[0].h < 497);
tick({ seal: true });
exit();
// A reliable lift boarding procedure: wait at the edge for a low platform.
function liftBoard(index: number, x: number, edge: number) {
  if (s.parcel.open) tick({ seal: true });
  move(edge);
  stop();
  until(() => s.machines[index].py > 560);
  jumpTo(x);
}
liftBoard(0, 505, 365);
until(() => s.machines[0].py < 391);
tick({ seal: true });
move(565);
jumpTo(710);
exit();
if (s.parcel.open) tick({ seal: true });
move(285);
jumpTo(505);
move(500);
stop();
until(() => s.machines[1].py < 340);
tick({ seal: true });
tick({ interact: true });
if (s.parcel.carried) throw Error("Not transmitted");
move(490);
jumpTo(400);
stop();
until(() => s.player.grounded);
until(() => s.machines[0].py > 560);
move(405);
until(() => s.player.support === "bypass");
until(() => s.machines[0].py < 400);
move(465);
jumpTo(610);
move(705);
jumpTo(920);
move(868);
stop();
tick({ interact: true });
if (!s.parcel.carried) throw Error("No parcel " + JSON.stringify(s.player));
exit();
if (s.parcel.open) tick({ seal: true });
move(300);
stop();
until(() => s.machines[0].px >= 425 && s.machines[0].px <= 440);
tick({ seal: true });
jumpTo(500);
move(s.machines[0].px + 120);
jumpTo(730);
liftBoard(1, 975, 842);
until(() => s.machines[1].py < 378);
tick({ seal: true });
move(1010);
jumpTo(1140);
if (s.roomIndex === 4) exit();
move(1085);
stop();
tick({ interact: true });
if (!s.completed) throw Error("Not delivered");
console.log("DELIVERED", s.elapsed, s.deaths, replay.length);
mkdirSync("output", { recursive: true });
writeFileSync("output/replay.json", JSON.stringify(replay));
