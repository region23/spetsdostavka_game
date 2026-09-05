import test from "node:test";
import assert from "node:assert/strict";
import { NarrativeController } from "../src/narrative";

test("dialogue waits for a safe moment and gives each speaker time", () => {
  const n = new NarrativeController();
  n.event("room", 1);
  assert.equal(n.update(30, false), null);
  assert.equal(n.subtitle, "");
  assert.equal(n.update(0)?.id, "hall-rejected");
  const first = n.subtitle;
  n.event("seal-open", 1);
  n.update(1);
  assert.equal(n.subtitle, first);
  n.update(30);
  assert.equal(n.subtitle, "");
  assert.equal(n.update(1), null);
  assert.equal(n.update(0.5)?.id, "hall-neighbours");
});

test("repeated actions and checkpoint retries do not repeat heard lines", () => {
  const n = new NarrativeController();
  n.event("pickup", 0);
  n.event("pickup", 0);
  n.update(0);
  n.event("pickup", 0);
  n.update(30);
  assert.equal(n.update(2), null);
  const restored = new NarrativeController();
  restored.restore(n.snapshot());
  restored.event("pickup", 0);
  assert.equal(restored.update(0), null);
  assert.deepEqual(restored.history, n.history);
  restored.reset();
  restored.event("pickup", 0);
  assert.equal(restored.update(0)?.id, "dispatch-parcel");
});

test("room transition preserves the current line but discards stale pending chatter", () => {
  const n = new NarrativeController();
  n.event("room", 1);
  n.update(0);
  n.event("room", 2);
  assert.equal(n.current?.id, "hall-rejected");
  n.update(30);
  assert.equal(n.update(2)?.id, "bus-courier");
});

test("legacy and malformed narrative saves are harmless", () => {
  const n = new NarrativeController();
  n.restore();
  assert.deepEqual(n.history, []);
  n.restore({ heard: ["hall-rejected", "<script>bad</script>", "hall-rejected", 42] } as never);
  assert.deepEqual(n.snapshot().heard, ["hall-rejected"]);
  n.restore({ heard: "bad" } as never);
  assert.deepEqual(n.history, []);
});

test("delivery records the result and clears chatter before the ending", () => {
  const n = new NarrativeController();
  n.event("room", 5);
  n.update(0);
  n.event("delivered", 5);
  assert.equal(n.subtitle, "");
  assert.equal(n.update(30), null);
  assert.equal(n.history.at(-1)?.id, "hall-accepted");
});
