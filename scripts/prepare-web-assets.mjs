import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

// Delivery variants only; preserve all original generated artwork.
const assets = ["post-office", "service-hall", "small-hall", "city-distance",
  "intro-city", "intro-acceptance", "intro-delivery", "parcel-cutout"];
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
});
try {
  const page = await browser.newPage();
  for (const name of assets) {
    const original = readFileSync(`public/assets/${name}.png`);
    const result = await page.evaluate(async ({ source, maxWidth }) => {
      const image = new Image(); image.src = `data:image/png;base64,${source}`; await image.decode();
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / image.width);
      canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      const ctx = canvas.getContext("2d"); ctx.imageSmoothingQuality = "high";
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const url = canvas.toDataURL("image/webp", 0.88);
      if (!url.startsWith("data:image/webp;")) throw new Error("WebP encoder unavailable");
      return { base64: url.split(",")[1], width: canvas.width, height: canvas.height };
    }, { source: original.toString("base64"), maxWidth: name === "parcel-cutout" ? 640 : 1280 });
    const encoded = Buffer.from(result.base64, "base64");
    writeFileSync(`public/assets/${name}.webp`, encoded);
    console.log(`${name}: ${original.length} → ${encoded.length} bytes (${result.width}×${result.height})`);
  }
} finally { await browser.close(); }
