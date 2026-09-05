import type * as Phaser from "phaser";

// Keep simulation coordinates independent of the screen and camera.
export function installDisplaySizing(scene: Phaser.Scene, touch: boolean) {
  const parent = document.querySelector<HTMLElement>("#game")!;
  const worldHeight = 720;
  let pixelRatio = window.devicePixelRatio;
  let viewWidth = 1280, viewHeight = worldHeight;
  const resize = () => {
    const bounds = parent.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    pixelRatio = window.devicePixelRatio;
    if (touch) {
      // Fill the phone stage. Limit the buffer, not the visible character size.
      const density = Math.min(pixelRatio, 2, 1280 / bounds.width, 960 / bounds.height);
      const width = Math.max(1, Math.round(bounds.width * density));
      const height = Math.max(1, Math.round(bounds.height * density));
      const zoom = Math.max(0.7, bounds.width / 1280, bounds.height / 720) * density;
      scene.scale.getParentBounds();
      scene.scale.setGameSize(width, height);
      scene.cameras.main.setOrigin(0, 0).setZoom(zoom);
      viewWidth = width / zoom;
      viewHeight = height / zoom;
      return;
    }
    const fit = Math.min(bounds.width / 1280, bounds.height / worldHeight);
    // The courier atlas holds 3× detail; larger buffers add no source detail.
    const density = Math.min(3, fit * pixelRatio);
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
  // A smaller screen sees part of the room at a readable scale. Follow both
  // axes so lifts, upper platforms and room exits stay reachable on screen.
  return (x: number, y: number) => {
    if (!touch) return;
    const clamp = (value: number, max: number) => Math.max(0, Math.min(value, max));
    scene.cameras.main.setScroll(
      clamp(x - viewWidth * 0.4, 1280 - viewWidth),
      clamp(y - viewHeight * 0.8, 720 - viewHeight),
    );
  };
}
