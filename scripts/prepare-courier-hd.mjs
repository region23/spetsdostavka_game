import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

// Texture preparation only: chroma-key the generated source, isolate its eight
// silhouettes, then pack at 3× game size. Never enlarge the old 96×120 atlas.
const frameWidth = 288, frameHeight = 360, sourceScale = 0.63;
const names = ["idle", "run1", "run2", "run3", "jump", "fall", "hang", "interact"];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const page = await browser.newPage();
  const result = await page.evaluate(async ({ source, frameWidth, frameHeight, sourceScale }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${source}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width; canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data, width, height } = pixels;
    const backgroundGreen = data[1];
    const original = new Uint8ClampedArray(data);
    // Solve C = alpha F + (1 - alpha) green. Removing green from RGB as
    // well as alpha prevents a colored fringe when the atlas is filtered.
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const spill = Math.max(0, g - Math.max(r, b));
      const alpha = Math.max(0, 1 - spill / backgroundGreen);
      if (alpha < 0.08) { data.fill(0, i, i + 4); continue; }
      data[i] = Math.min(255, r / alpha);
      data[i + 1] = Math.min(255, (g - spill) / alpha);
      data[i + 2] = Math.min(255, b / alpha);
      data[i + 3] = Math.round(255 * alpha);
    }
    // Edge RGB must come from the figure, not from amplified matte noise.
    // Find nearby opaque interior colors before resampling the cutout.
    const opaque = Uint8Array.from({ length: width * height }, (_, i) => data[i * 4 + 3] === 255 ? 1 : 0);
    for (let at = 0; at < width * height; at++) {
      const i = at * 4;
      if (!data[i + 3] || data[i + 3] === 255) continue;
      const x = at % width, y = Math.floor(at / width);
      let nearest = -1, distance = Infinity;
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const nx = x + dx, ny = y + dy, next = (ny * width + nx) * 4;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height || !opaque[next / 4]) continue;
        const d = dx * dx + dy * dy;
        if (d < distance) { nearest = next; distance = d; }
      }
      if (nearest < 0) { data.fill(0, i, i + 4); continue; }
      const fr = original[nearest], fg = original[nearest + 1], fb = original[nearest + 2];
      const alpha = Math.max(0, Math.min(1,
        (original[i] * fr + (original[i + 1] - backgroundGreen) * (fg - backgroundGreen) + original[i + 2] * fb)
        / (fr * fr + (fg - backgroundGreen) ** 2 + fb * fb)));
      data[i] = fr; data[i + 1] = fg; data[i + 2] = fb;
      data[i + 3] = alpha < 0.08 ? 0 : Math.round(alpha * 255);
    }
    // Find actual connected figures; generated sheets are not exact grids.
    const visited = new Uint8Array(width * height), components = [];
    for (let i = 0; i < visited.length; i++) {
      if (visited[i] || !data[i * 4 + 3]) continue;
      const body = [i]; visited[i] = 1;
      let left = width, right = 0, top = height, bottom = 0;
      for (let cursor = 0; cursor < body.length; cursor++) {
        const at = body[cursor], x = at % width, y = Math.floor(at / width);
        left = Math.min(left, x); right = Math.max(right, x);
        top = Math.min(top, y); bottom = Math.max(bottom, y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, next = ny * width + nx;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height || visited[next] || !data[next * 4 + 3]) continue;
          visited[next] = 1; body.push(next);
        }
      }
      if (body.length > 1000) components.push({ body, left, right, top, bottom });
    }
    if (components.length !== 8) throw new Error(`Expected 8 isolated poses, got ${components.length}`);
    components.sort((a, b) => Math.floor((a.top + a.bottom) / height) - Math.floor((b.top + b.bottom) / height) || a.left - b.left);
    const atlas = document.createElement("canvas");
    atlas.width = frameWidth * 8; atlas.height = frameHeight;
    const target = atlas.getContext("2d");
    target.imageSmoothingQuality = "high";
    const bounds = [];
    components.forEach((part, index) => {
      const w = part.right - part.left + 1, h = part.bottom - part.top + 1;
      const crop = document.createElement("canvas"); crop.width = w; crop.height = h;
      const cropCtx = crop.getContext("2d"), cutout = cropCtx.createImageData(w, h);
      for (const at of part.body) {
        const next = ((Math.floor(at / width) - part.top) * w + at % width - part.left) * 4;
        cutout.data.set(data.subarray(at * 4, at * 4 + 4), next);
      }
      cropCtx.putImageData(cutout, 0, 0);
      const dw = w * sourceScale, dh = h * sourceScale;
      if (dw > frameWidth - 12 || dh > frameHeight - 12) throw new Error(`Pose ${index} exceeds frame`);
      target.drawImage(crop, index * frameWidth + (frameWidth - dw) / 2, frameHeight - 6 - dh, dw, dh);
      bounds.push({ x: part.left, y: part.top, w, h, pixels: part.body.length });
    });
    return { png: atlas.toDataURL("image/png").split(",")[1], bounds, backgroundGreen };
  }, {
    source: readFileSync("public/assets/courier-hd-source.png").toString("base64"),
    frameWidth, frameHeight, sourceScale,
  });
  writeFileSync("public/assets/courier-hd.png", Buffer.from(result.png, "base64"));
  const frames = Object.fromEntries(names.map((name, i) => [name, {
    frame: { x: i * frameWidth, y: 0, w: frameWidth, h: frameHeight },
    rotated: false, trimmed: false,
    spriteSourceSize: { x: 0, y: 0, w: frameWidth, h: frameHeight },
    sourceSize: { w: frameWidth, h: frameHeight }, pivot: { x: 0.5, y: 1 },
  }]));
  writeFileSync("public/assets/courier-hd.json", JSON.stringify({ frames, meta: {
    image: "courier-hd.png", format: "RGBA8888", size: { w: frameWidth * 8, h: frameHeight }, scale: "1",
  } }, null, 2) + "\n");
  console.log(JSON.stringify({ ...result, png: undefined, names }, null, 2));
} finally {
  await browser.close();
}
