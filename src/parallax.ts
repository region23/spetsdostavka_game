import * as Phaser from "phaser";

// Window apertures measured in the original 1672 × 941 hall illustration.
const hallWindows = [
  { left: -178, right: 83, top: 210, shoulder: 358 },
  { left: 173, right: 434, top: 210, shoulder: 358 },
  { left: 525, right: 786, top: 210, shoulder: 358 },
  { left: 876, right: 1138, top: 210, shoulder: 358 },
  { left: 1226, right: 1488, top: 210, shoulder: 358 },
  { left: 1577, right: 1840, top: 210, shoulder: 358 },
];

export class ParallaxBackdrop {
  readonly architecture: Phaser.GameObjects.Image;
  readonly city: Phaser.GameObjects.Image;
  private glassFrames: Phaser.GameObjects.Graphics;
  private aperture: Phaser.GameObjects.Graphics;
  private offset = 0;
  private family = "hall";
  private readonly scale = 1.06;

  constructor(scene: Phaser.Scene) {
    this.architecture = scene.add.image(640, 360, "hall")
      .setDisplaySize(1280 * this.scale, 720 * this.scale).setDepth(0);
    this.city = scene.add.image(640, 345, "city-distance")
      .setDisplaySize(1450, 740).setDepth(0.5);
    this.aperture = scene.make.graphics({ x: 0, y: 0 });
    this.city.setMask(this.aperture.createGeometryMask());
    this.glassFrames = scene.add.graphics().setDepth(0.75);
    this.drawWindows();
  }

  private drawWindows() {
    const g = this.aperture;
    g.clear().fillStyle(0xffffff).beginPath();
    for (const window of hallWindows) {
      const { left, right, top, shoulder } = window;
      const center = (left + right) / 2;
      const radius = (right - left) / 2;
      const roof = (x: number) => shoulder - (shoulder - top) *
        Math.sqrt(Math.max(0, 1 - ((x - center) / radius) ** 2));
      g.moveTo(left, 733).lineTo(right, 733);
      for (let x = right; x > left; x -= 2) g.lineTo(x, roof(x));
      g.lineTo(left, roof(left)).closePath();
      for (let pane = 1; pane < 3; pane++) {
        const x = left + pane * (right - left) / 3;
        this.glassFrames.lineStyle(4, 0x8b7754, 0.95);
        this.glassFrames.lineBetween(x, roof(x), x, 733);
        this.glassFrames.lineStyle(1, 0xe9d9ad, 0.85);
        this.glassFrames.lineBetween(x - 1, roof(x), x - 1, 733);
      }
      this.glassFrames.lineStyle(5, 0x8b7754, 0.95);
      this.glassFrames.lineBetween(left, 407, right, 407);
      this.glassFrames.lineStyle(1.5, 0xe9d9ad, 0.9);
      this.glassFrames.lineBetween(left, 405, right, 405);
    }
    g.fillPath();
    g.setScale(1280 / 1672 * this.scale, 720 / 941 * this.scale);
    this.glassFrames.setScale(g.scaleX, g.scaleY);
  }

  setRoom(family: string, playerX: number, reducedMotion: boolean) {
    this.family = family;
    this.architecture.setTexture(family);
    // Different source dimensions must not change the background's coverage.
    this.architecture.setDisplaySize(1280 * this.scale, 720 * this.scale);
    this.offset = reducedMotion ? 0 : Phaser.Math.Clamp((playerX - 640) / 640, -1, 1);
    this.place();
  }

  update(playerX: number, delta: number, moving: boolean, reducedMotion: boolean) {
    if (reducedMotion) this.offset = 0;
    else if (moving) {
      const target = Phaser.Math.Clamp((playerX - 640) / 640, -1, 1);
      this.offset += (target - this.offset) * (1 - Math.exp(-delta / 140));
    }
    this.place();
  }

  private place() {
    const nearX = -this.offset * 26;
    this.architecture.setPosition(640 + nearX, 360);
    this.aperture.setPosition(-1280 * (this.scale - 1) / 2 + nearX,
      -720 * (this.scale - 1) / 2);
    this.glassFrames.setPosition(this.aperture.x, this.aperture.y).setVisible(this.family === "hall");
    this.city.setPosition(640 - this.offset * 60, 345)
      .setVisible(this.family === "hall");
  }
}
