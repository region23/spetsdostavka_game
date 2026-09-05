import type * as Phaser from "phaser";

// Simulation coordinates stay at 1280×720. Render desktop scenes directly
// into screen pixels instead of enlarging an already downsampled character.
export function installDisplaySizing(scene: Phaser.Scene, touch: boolean) {
  const parent = document.querySelector<HTMLElement>("#game")!;
  const worldHeight = touch ? 640 : 720;
  let pixelRatio = window.devicePixelRatio;
  const resize = () => {
    const bounds = parent.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pixelRatio = window.devicePixelRatio;
    const fit = Math.min(bounds.width / 1280, bounds.height / worldHeight);
    // The courier atlas holds 3× detail. Bound the desktop backing buffer;
    // retain the mobile rendering budget while improving desktop sharpness.
    const density = touch ? 1 : Math.min(3, fit * pixelRatio);
    const width = Math.max(1, Math.round(1280 * density)), height = Math.max(1, Math.round(worldHeight * density));
    scene.scale.getParentBounds();
    if (scene.scale.gameSize.width !== width || scene.scale.gameSize.height !== height)
      scene.scale.setGameSize(width, height);
    else scene.scale.refresh();
    scene.cameras.main.setOrigin(0, 0).setZoom(width / 1280).setScroll(0, 0);
  };
  // Moving a window between monitors can change DPR without resizing its
  // CSS box. Check the scalar before drawing; measure layout only on change.
  const densityChanged = () => { if (window.devicePixelRatio !== pixelRatio) resize(); };
  const observer = new ResizeObserver(resize);
  observer.observe(parent);
  scene.events.on("preupdate", densityChanged);
  resize();
  scene.events.once("shutdown", () => {
    observer.disconnect();
    scene.events.off("preupdate", densityChanged);
  });
}
