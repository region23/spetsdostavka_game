import test from "node:test";
import assert from "node:assert/strict";
import { Simulation, STEP, advanceMachine, affected } from "../src/simulation";
import { validateRooms } from "../src/rooms";
const tick = (s: Simulation, n: number, input = {}) => {
  for (let i = 0; i < n; i++) s.step(input);
};
test("all room geometry is valid", () => validateRooms());
test("all four machine families freeze and resume the preserved phase", () => {
  const s = new Simulation();
  for (let r = 0; r < 6; r++) {
    s.loadRoom(r);
    for (const m of s.machines) {
      const phase = m.phase;
      m.stopped = true;
      advanceMachine(m, STEP);
      assert.equal(m.phase, phase);
      m.stopped = false;
      advanceMachine(m, STEP);
      assert.notEqual(m.phase, phase);
    }
  }
});
test("field is local to the parcel and passes through the transfer wall", () => {
  const s = new Simulation();
  s.loadRoom(3);
  s.player.x = 505;
  s.player.y = 610;
  s.parcel.open = true;
  s.syncParcel();
  s.interact();
  assert.equal(s.parcel.carried, false);
  const [lift, press] = s.machines;
  assert.equal(
    affected(s.parcel, { x: lift.px, y: lift.py, w: lift.w, h: lift.h }),
    false,
  );
  assert.equal(
    affected(s.parcel, { x: press.px, y: press.py, w: press.w, h: press.h }),
    true,
  );
  s.step({});
  assert.equal(press.stopped, true);
  assert.equal(lift.stopped, false);
});
test("a closed parcel can be recalled, opened and retransmitted", () => {
  const s = new Simulation();
  s.loadRoom(3);
  s.player.x = 505;
  s.syncParcel();
  s.interact();
  assert.equal(s.parcel.open, false);
  s.interact();
  assert.equal(s.parcel.carried, true);
  s.step({ seal: true });
  s.interact();
  assert.equal(s.parcel.open, true);
  assert.equal(s.parcel.carried, false);
});
test("one E performs one action, dropping preserves active seal", () => {
  const s = new Simulation();
  s.player.x = 435;
  s.interact();
  assert.equal(s.parcel.carried, true);
  s.parcel.open = true;
  s.interact();
  assert.equal(s.parcel.carried, false);
  assert.equal(s.parcel.open, true);
});
test("death restores hero, parcel and machine phases together", () => {
  const s = new Simulation();
  s.loadRoom(3);
  const checkpoint = s.snapshot();
  s.player.x = 505;
  s.interact();
  tick(s, 60);
  s.die();
  tick(s, 55);
  assert.equal(s.parcel.carried, checkpoint.parcel.carried);
  assert.equal(s.flags.windowSent, false);
  assert.ok(Math.abs(s.player.x - checkpoint.player.x) < 1);
});
test("lift carries its rider without drifting", () => {
  const s = new Simulation();
  s.loadRoom(2);
  s.player.x = 490;
  s.player.y = 610;
  s.player.support = "lift";
  tick(s, 90);
  assert.ok(s.player.y < 520);
  assert.equal(s.player.support, "lift");
  assert.ok(Math.abs(s.player.y - s.machines[0].py) < 0.1);
});
test("permanent open seal prevents the lift from transporting player", () => {
  const s = new Simulation();
  s.loadRoom(2);
  s.player.x = 490;
  s.player.y = 610;
  s.player.support = "lift";
  s.parcel.open = true;
  tick(s, 90);
  assert.equal(s.machines[0].phase, 0);
  assert.equal(s.player.y, 610);
});
test("fixed step produces equal states across render rates", () => {
  function simulate(fps: number) {
    const s = new Simulation();
    s.loadRoom(1);
    let acc = 0;
    for (let i = 0; i < fps * 2; i++) {
      acc += 1 / fps;
      while (acc + 1e-9 >= STEP) {
        s.step({ right: true });
        acc -= STEP;
      }
    }
    return s.snapshot();
  }
  assert.deepEqual(simulate(30), simulate(60));
  assert.deepEqual(simulate(60), simulate(120));
});
test("room exit never abandons parcel", () => {
  const s = new Simulation();
  s.player.x = 1200;
  tick(s, 2);
  assert.equal(s.roomIndex, 0);
  s.parcel.carried = true;
  tick(s, 2);
  assert.equal(s.roomIndex, 1);
});
test("delivery completes only once and clears field", () => {
  const s = new Simulation();
  s.loadRoom(5);
  s.player.x = 1100;
  s.interact();
  assert.equal(s.completed, true);
  assert.equal(s.parcel.delivered, true);
  assert.equal(s.parcel.open, false);
  const state = s.snapshot();
  tick(s, 60, { interact: true });
  assert.deepEqual(s.snapshot(), state);
});
test("controlled descent hangs from a static edge then releases", () => {
  const s = new Simulation();
  s.player.x = 235;
  s.step({ down: true });
  assert.ok(s.player.hang);
  assert.equal(s.player.pose, "hang");
  s.step({ down: true });
  assert.equal(s.player.hang, null);
  assert.ok(s.player.drop > 0);
});
test("pickup in midair still saves a safe standing checkpoint", () => {
  const s = new Simulation();
  s.player.x = 435;
  s.player.y = 559;
  s.player.grounded = false;
  s.player.vy = -200;
  s.interact();
  assert.equal(s.checkpoint.player.y, 610);
  assert.equal(s.checkpoint.player.vy, 0);
  assert.equal(s.checkpoint.player.grounded, true);
});
test("hanging courier follows the moving ledge", () => {
  const s = new Simulation();
  s.loadRoom(2);
  s.player.hang = { x: 405, y: 610, dir: 1, support: "lift" };
  s.player.x = 387;
  s.player.y = 686;
  tick(s, 60);
  assert.ok(s.player.hang);
  assert.ok(s.player.hang!.y < 610);
  assert.ok(Math.abs(s.player.hang!.y - s.machines[0].py) < 0.01);
});
