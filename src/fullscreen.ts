// Installed iOS web apps do not expose document.fullscreenElement.
export const isStandalone = () => matchMedia("(display-mode: standalone)").matches ||
  matchMedia("(display-mode: fullscreen)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const canFullscreen = () => document.fullscreenEnabled &&
  typeof document.documentElement.requestFullscreen === "function";
export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (canFullscreen()) await document.documentElement.requestFullscreen();
    else return false;
    return true;
  } catch { return false; }
}
export const isAppleMobile = () => /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
