import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

// Repair atlas extraction without repainting or rescaling the existing character.
// An overlapping source crop captured a detached hand from the adjacent pose.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const page = await browser.newPage();
  const source = readFileSync("public/assets/courier-ready.png").toString("base64");
  const result = await page.evaluate(async source => {
    const image = new Image();
    image.src = `data:image/png;base64,${source}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const removed = [];
    for (let frame = 0; frame < 8; frame++) {
      const visited = new Uint8Array(96 * 120);
      const components = [];
      const alpha = i => pixels.data[((Math.floor(i / 96) * canvas.width) + frame * 96 + i % 96) * 4 + 3];
      for (let i = 0; i < visited.length; i++) {
        if (visited[i] || !alpha(i)) continue;
        const component = [i];
        visited[i] = 1;
        for (let cursor = 0; cursor < component.length; cursor++) {
          const at = component[cursor], x = at % 96, y = Math.floor(at / 96);
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy, next = ny * 96 + nx;
            if (nx < 0 || nx >= 96 || ny < 0 || ny >= 120 || visited[next] || !alpha(next)) continue;
            visited[next] = 1;
            component.push(next);
          }
        }
        components.push(component);
      }
      components.sort((a, b) => b.length - a.length);
      let count = 0;
      for (const component of components.slice(1)) for (const i of component) {
        const at = ((Math.floor(i / 96) * canvas.width) + frame * 96 + i % 96) * 4;
        pixels.data.fill(0, at, at + 4);
        count++;
      }
      removed.push({ frame, bodyPixels: components[0].length, removedPixels: count });
    }
    ctx.putImageData(pixels, 0, 0);
    return { png: canvas.toDataURL("image/png").split(",")[1], removed };
  }, source);
  writeFileSync("public/assets/courier-clean.png", Buffer.from(result.png, "base64"));
  const atlas = JSON.parse(readFileSync("public/assets/courier-ready.json", "utf8"));
  atlas.meta.image = "courier-clean.png";
  writeFileSync("public/assets/courier-clean.json", JSON.stringify(atlas, null, 2) + "\n");
  console.log(JSON.stringify(result.removed));
} finally {
  await browser.close();
}
