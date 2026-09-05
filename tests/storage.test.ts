import test from "node:test";
import assert from "node:assert/strict";
import { CheckpointService, DEFAULT_SETTINGS } from "../src/storage";
import { Simulation } from "../src/simulation";
const local = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => local.get(k) ?? null,
    setItem: (k: string, v: string) => local.set(k, v),
  },
});
const make = () => ({
  snapshot: new Simulation().snapshot(),
  elapsed: 24,
  deaths: 1,
  helpUsed: false,
  completed: false,
});
test("save round trip preserves a coherent checkpoint", () => {
  local.clear();
  const c = new CheckpointService(),
    s = make();
  c.save(s);
  assert.deepEqual(c.load(), s);
});
test("corrupt save does not erase settings", () => {
  local.clear();
  local.set("spets-save", "{broken");
  const c = new CheckpointService();
  c.write("settings", { ...DEFAULT_SETTINGS, music: 0.2 });
  assert.equal(c.load(), null);
  assert.equal(c.settings().music, 0.2);
});
test("invalid room and nonnumeric phase are rejected", () => {
  const c = new CheckpointService();
  let s = make();
  s.snapshot.room = 99;
  c.save(s);
  assert.equal(c.load(), null);
  s = make();
  s.snapshot.machines[0].phase = NaN;
  c.save(s);
  assert.equal(c.load(), null);
});
test("unavailable storage falls back to memory and warns honestly", () => {
  const old = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem() {
        throw Error("denied");
      },
      setItem() {
        throw Error("denied");
      },
    },
  });
  const c = new CheckpointService();
  c.save(make());
  assert.equal(c.available, false);
  assert.match(c.warning, /только до закрытия/);
  assert.deepEqual(c.load(), make());
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: old,
  });
});

test("tampered machine geometry cannot corrupt a restored room", () => {
  const c = new CheckpointService();
  const s = make();
  s.snapshot.machines[0].w = 99999;
  c.save(s);
  assert.equal(c.load(), null);
});
