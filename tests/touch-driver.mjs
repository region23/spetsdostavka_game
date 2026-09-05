// Send real Chromium touch events (including simultaneous fingers) to the
// visible buttons. No mutation of simulation state or injected key events.
export async function touchDriver(page) {
  const session = await page.context().newCDPSession(page);
  const actions = ["left", "right", "jump", "down", "interact", "seal"];
  let current = new Map();
  const point = async action => {
    const box = await page.locator(`[data-control="${action}"]`).boundingBox();
    if (!box) throw new Error(`Missing touch button: ${action}`);
    return { id: actions.indexOf(action) + 1, x: box.x + box.width / 2, y: box.y + box.height / 2, radiusX: 4, radiusY: 4, force: 1 };
  };
  return {
    async input(next) {
      for (const action of [...current.keys()]) if (!next.includes(action)) {
        const released = current.get(action);
        current.delete(action);
        // Chromium 149/152 targets the supplied contact on touchEnd; an empty
        // list releases every finger. Verify with pointerup, not just motion.
        await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [released] });
      }
      for (const action of next) if (!current.has(action)) {
        current.set(action, await point(action));
        await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [...current.values()] });
      }
    },
    async cancel() {
      current.clear();
      await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    },
  };
}
