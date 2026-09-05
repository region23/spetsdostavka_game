import * as Phaser from "phaser";
import { assetURL } from "./assets";
import {
  sim,
  mode,
  settings,
  ready,
  progress,
  assetError,
  frame,
} from "./main";
import { RADIUS, PW, PH } from "./simulation";
const C = {
  ink: 0x253b3c,
  cream: 0xe5deca,
  light: 0xf5eedf,
  sage: 0x73877c,
  dark: 0x3c5551,
  red: 0xb7462e,
  gold: 0xbd9962,
  teal: 0x608c7c,
};
export class GameScene extends Phaser.Scene {
  bg!: Phaser.GameObjects.Image;
  staticG!: Phaser.GameObjects.Graphics;
  dynamicG!: Phaser.GameObjects.Graphics;
  fieldG!: Phaser.GameObjects.Graphics;
  hero!: Phaser.GameObjects.Image;
  bag!: Phaser.GameObjects.Image;
  labels: Phaser.GameObjects.Text[] = [];
  machineLabels: Phaser.GameObjects.Text[] = [];
  debugText!: Phaser.GameObjects.Text;
  debug = false;
  menuBagURL = "";
  transition = 0;
  room = -1;
  train!: Phaser.GameObjects.Graphics;
  constructor() {
    super("Route");
  }
  preload() {
    this.load.on("progress", progress);
    this.load.on("loaderror", assetError);
    this.load.image("hall", assetURL("post-office.png"));
    this.load.image("shaft", assetURL("service-hall.png"));
    this.load.image("club", assetURL("small-hall.png"));
    this.load.atlas(
      "courier",
      assetURL("courier-ready.png"),
      assetURL("courier-ready.json"),
    );
    this.load.image("bag", assetURL("parcel-cutout.png"));
  }
  create() {
    if (
      !["hall", "shaft", "club", "courier", "bag"].every((k) =>
        this.textures.exists(k),
      )
    ) {
      assetError();
      return;
    }
    this.menuBagURL = assetURL("parcel-cutout.png");
    this.bg = this.add
      .image(640, 360, "hall")
      .setDisplaySize(1280, 720)
      .setDepth(0);
    this.train = this.add.graphics().setDepth(1);
    this.staticG = this.add.graphics().setDepth(3);
    this.fieldG = this.add.graphics().setDepth(5);
    this.dynamicG = this.add.graphics().setDepth(6);
    this.hero = this.add
      .image(120, 610, "courier", "idle")
      .setOrigin(0.5, 1)
      .setDepth(8);
    this.bag = this.add
      .image(100, 567, "bag")
      .setDisplaySize(40, 40)
      .setDepth(9);
    this.debugText = this.add
      .text(15, 110, "", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#ffffff",
        backgroundColor: "#253b3c",
        padding: { x: 8, y: 8 },
      })
      .setDepth(20);
    this.rebuild();
    ready();
  }
  text(x: number, y: number, text: string, size = 16, color = "#344b46") {
    const t = this.add
      .text(x, y, text, {
        fontFamily: "Arial, sans-serif",
        fontSize: size + "px",
        fontStyle: "bold",
        color,
        letterSpacing: 2,
      })
      .setDepth(4);
    this.labels.push(t);
    return t;
  }
  rebuild() {
    if (!this.staticG) return;
    this.room = sim.roomIndex;
    this.transition = settings.reducedMotion ? 0 : 0.35;
    for (const t of this.labels) t.destroy();
    this.labels = [];
    for (const t of this.machineLabels) t.destroy();
    this.machineLabels = [];
    this.bg.setTexture(sim.room.family);
    const g = this.staticG;
    g.clear();
    // Structural platform faces are separate from the painted rear architecture.
    for (const p of sim.room.platforms) {
      g.fillStyle(C.ink, 0.13);
      g.fillRect(p.x + 12, p.y + 12, p.w, p.h);
      g.fillStyle(C.sage);
      g.fillRect(p.x, p.y, p.w, p.h);
      g.fillStyle(C.dark, 0.3);
      g.fillRect(p.x, p.y + 38, p.w, p.h - 38);
      g.fillStyle(C.light);
      g.fillRect(p.x, p.y, p.w, 12);
      g.fillStyle(C.gold);
      g.fillRect(p.x, p.y + 12, p.w, 5);
      g.lineStyle(1, C.light, 0.15);
      for (let x = p.x + 65; x < p.x + p.w; x += 120)
        g.lineBetween(x, p.y + 28, x, p.y + p.h);
      g.lineStyle(2, C.ink, 0.4);
      g.lineBetween(p.x, p.y + p.h, p.x, p.y);
      g.lineBetween(p.x + p.w, p.y, p.x + p.w, p.y + p.h);
    }
    for (const m of sim.machines) {
      if (m.kind === "lift") {
        g.fillStyle(C.ink, 0.13);
        g.fillRect(m.x - 8, 195, m.w + 16, 525);
        g.fillStyle(C.gold);
        g.fillRect(m.x + 16, 195, 6, 525);
        g.fillRect(m.x + m.w - 22, 195, 6, 525);
        g.lineStyle(2, C.dark, 0.5);
        for (let y = 210; y < 715; y += 30) {
          g.lineBetween(m.x + 16, y, m.x + 28, y);
          g.lineBetween(m.x + m.w - 28, y, m.x + m.w - 16, y);
        }
      } else if (m.kind === "press") {
        g.fillStyle(C.dark);
        g.fillRoundedRect(m.x - 14, 170, m.w + 28, 44, 4);
        g.fillStyle(C.gold);
        g.fillRect(m.x + 15, 212, 12, 225);
        g.fillRect(m.x + m.w - 27, 212, 12, 225);
      } else if (m.kind === "carriage") {
        g.lineStyle(5, C.gold, 0.6);
        g.lineBetween(m.x - 5, m.y + 38, m.toX + m.w + 5, m.y + 38);
        g.lineStyle(1, C.dark);
        g.lineBetween(m.x - 5, m.y + 45, m.toX + m.w + 5, m.y + 45);
      }
    }
    for (const sign of sim.room.signs) {
      const final = sim.completed && sim.roomIndex === 5;
      const text = final ? "ЗАЛ ОТКРЫТ" : sign.text;
      const t = this.text(
        sign.x,
        sign.y,
        text,
        sim.roomIndex === 5 ? 18 : 16,
        sim.roomIndex === 5 ? "#efe8d6" : "#344b46",
      );
      if (sim.roomIndex === 5) {
        g.fillStyle(final ? C.dark : C.red, 0.92);
        g.fillRoundedRect(sign.x - 16, sign.y - 12, 390, 45, 3);
      }
    }
    if (sim.roomIndex === 0) {
      g.fillStyle(C.dark);
      g.fillRoundedRect(401, 535, 70, 75, 4);
      g.fillStyle(C.gold);
      g.fillRect(396, 531, 80, 8);
      this.text(413, 553, "12-Б", 15, "#efe8d6");
    }
    if (sim.roomIndex === 3) {
      g.fillStyle(C.ink);
      g.fillRoundedRect(509, 539, 216, 59, 5);
      g.fillStyle(C.gold);
      g.fillRect(505, 587, 226, 12);
      g.fillStyle(C.light);
      g.fillRoundedRect(514, 548, 28, 26, 3);
      this.text(518, 549, "✉", 22);
      g.lineStyle(2, C.light, 0.6);
      g.lineBetween(550, 553, 722, 553);
      g.fillStyle(C.gold);
      g.fillRect(508, 270, 8, 80);
      this.text(410, 250, "БЕЗ ОТПРАВЛЕНИЙ", 13);
    }
    if (sim.roomIndex === 5) {
      g.fillStyle(C.dark);
      g.fillRoundedRect(1060, 520, 85, 90, 6);
      g.fillStyle(C.gold);
      g.fillRoundedRect(1054, 515, 97, 14, 3);
      g.fillStyle(C.cream);
      g.fillRect(1075, 538, 55, 28);
      this.text(1087, 540, sim.completed ? "✓" : "↓", 24);
      this.text(1047, 480, "ПРИЁМКА", 16);
    } else {
      const e = sim.room.exit;
      g.fillStyle(C.dark, 0.86);
      g.fillRoundedRect(e.x, e.y + 13, 75, 87, 2);
      g.lineStyle(3, C.gold);
      g.strokeRect(e.x - 4, e.y + 9, 83, 91);
      this.text(e.x + 21, e.y + 35, "→", 32, "#f0e7cf");
    }
    for (const m of sim.machines)
      this.machineLabels.push(
        this.add
          .text(0, 0, "Ⅱ", {
            fontFamily: "Arial",
            fontSize: "23px",
            fontStyle: "bold",
            color: "#fff5de",
          })
          .setOrigin(0.5)
          .setDepth(7),
      );
  }
  update(_time: number, delta: number) {
    frame(delta);
    if (!this.dynamicG) return;
    if (this.room !== sim.roomIndex) this.rebuild();
    const p = sim.player,
      g = this.dynamicG,
      field = this.fieldG;
    g.clear();
    field.clear();
    const playing = [
      "game",
      "pause",
      "pause-ending",
      "restart",
      "help",
      "ending",
      "settings",
    ].includes(mode);
    this.hero.setVisible(playing);
    this.bag.setVisible(
      (playing && sim.flags.accepted && !sim.parcel.delivered) ||
        (mode === "game" && !sim.flags.accepted),
    );
    this.debugText.setVisible(this.debug && mode === "game");
    const pose =
      p.pose === "run"
        ? ["run1", "run2", "run3", "run2"][Math.floor(sim.elapsed * 10) % 4]
        : p.pose === "climb"
          ? "hang"
          : p.pose === "land"
            ? "jump"
            : p.pose;
    this.hero.setTexture(
      "courier",
      this.textures.get("courier").has(pose) ? pose : "idle",
    );
    this.hero.setPosition(p.x, p.y + 1).setFlipX(p.face < 0);
    this.bag
      .setPosition(sim.parcel.x, sim.parcel.y + 4)
      .setAngle(
        sim.parcel.carried && p.pose === "run"
          ? Math.sin(sim.elapsed * 12) * 4
          : 0,
      );
    if (playing) {
      g.fillStyle(C.ink, 0.16);
      if (p.grounded) g.fillEllipse(p.x, p.y + 2, 43, 8);
      if (sim.parcel.open && !sim.parcel.delivered) {
        field.fillStyle(C.teal, 0.07);
        field.fillCircle(sim.parcel.x, sim.parcel.y, RADIUS);
        field.lineStyle(1.5, C.dark, 0.4);
        field.strokeCircle(sim.parcel.x, sim.parcel.y, RADIUS);
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 12) {
          field.lineStyle(3, C.dark, 0.35);
          field.lineBetween(
            sim.parcel.x + Math.cos(a) * (RADIUS - 7),
            sim.parcel.y + Math.sin(a) * (RADIUS - 7),
            sim.parcel.x + Math.cos(a) * RADIUS,
            sim.parcel.y + Math.sin(a) * RADIUS,
          );
        }
      } else if (sim.nearParcel() && settings.hints && sim.flags.accepted) {
        field.lineStyle(1, C.dark, 0.1);
        field.strokeCircle(sim.parcel.x, sim.parcel.y, RADIUS);
      }
    }
    for (let i = 0; i < sim.machines.length; i++) {
      const m = sim.machines[i];
      const x = m.px,
        y = m.py;
      g.fillStyle(C.ink, 0.18);
      g.fillRect(x + 5, y + 5, m.w, m.h);
      g.fillStyle(m.stopped ? C.teal : C.red);
      g.fillRoundedRect(x, y, m.w, m.h, 3);
      g.fillStyle(C.light);
      g.fillRect(x, y, m.w, 7);
      g.fillStyle(C.ink, 0.4);
      g.fillRect(x, y + m.h - 6, m.w, 6);
      g.lineStyle(1, C.cream, 0.45);
      g.strokeRect(x + 5, y + 11, m.w - 10, Math.max(3, m.h - 22));
      if (m.kind === "press") {
        g.fillStyle(C.dark);
        g.fillRect(x + 40, 214, m.w - 80, Math.max(0, y - 214));
        g.fillStyle(C.gold);
        g.fillRect(x, y + m.h - 15, m.w, 9);
        for (let n = 0; n < m.w; n += 25) {
          g.fillStyle(C.dark);
          g.fillTriangle(
            x + n,
            y + m.h - 15,
            x + n + 10,
            y + m.h - 15,
            x + n + 16,
            y + m.h - 6,
          );
        }
        g.fillStyle(C.dark, 0.4);
        g.fillRect(x + 10, y + 20, 16, m.h - 50);
        g.fillRect(x + m.w - 26, y + 20, 16, m.h - 50);
      } else if (m.kind === "conveyor") {
        g.fillStyle(C.dark);
        g.fillRoundedRect(x, y + 4, m.w, 19, 9);
        for (let n = 0; n < m.w; n += 22) {
          const offset = m.stopped ? m.phase * 22 : m.phase * 22;
          g.fillStyle(C.gold);
          g.fillCircle(x + ((n + offset) % m.w), y + 13, 5);
        }
        g.fillStyle(C.red);
        g.fillRect(x + m.w / 2 - 22, y + 22, 44, 33);
      } else {
        g.fillStyle(C.gold);
        g.fillCircle(x + 15, y + m.h + 3, 7);
        g.fillCircle(x + m.w - 15, y + m.h + 3, 7);
        g.fillStyle(C.dark);
        g.fillRoundedRect(x + m.w / 2 - 21, y + 10, 42, 33, 3);
      }
      const label = this.machineLabels[i];
      label.setPosition(
        x + m.w / 2,
        y + (m.kind === "press" ? m.h / 2 : m.kind === "conveyor" ? 39 : 27),
      );
      // A quiet service seal identifies compatible equipment, without describing its motion.
      label.setText("Ⅱ").setAlpha(m.stopped ? 1 : 0.4);
      if (m.stopped) {
        g.lineStyle(2, C.light, 0.95);
        g.strokeRoundedRect(x - 3, y - 3, m.w + 6, m.h + 6, 4);
      }
      if (this.debug) {
        g.lineStyle(1, 0xff00ff);
        g.strokeRect(x, y, m.w, m.h);
      }
    }
    if (sim.flags.accepted && !sim.parcel.delivered && playing) {
      const x = sim.parcel.x,
        y = sim.parcel.y;
      g.fillStyle(sim.parcel.open ? C.teal : C.red);
      g.fillCircle(x + 13, y + 10, 10);
      g.fillStyle(C.light);
      if (sim.parcel.open) {
        g.fillRect(x + 9, y + 5, 3, 10);
        g.fillRect(x + 15, y + 5, 3, 10);
      } else g.fillTriangle(x + 10, y + 5, x + 10, y + 15, x + 18, y + 10);
    }
    if (this.debug) {
      g.lineStyle(1, 0xff00ff);
      g.strokeRect(p.x - PW / 2, p.y - PH, PW, PH);
      g.fillStyle(0xff00ff);
      g.fillCircle(sim.checkpoint.player.x, sim.checkpoint.player.y, 5);
      this.debugText.setText(
        `${sim.room.id} | ${p.pose} | x:${p.x.toFixed(1)} y:${p.y.toFixed(1)}\nvy:${p.vy.toFixed(1)} support:${p.support} | parcel: ${sim.parcel.carried ? "carried" : "placed"}\n${sim.machines.map((m) => m.id + ": " + m.phase.toFixed(3) + (m.stopped ? " PAUSED" : "")).join(" · ")}`,
      );
    }
    if (this.transition > 0) {
      this.transition -= delta / 1000;
      g.fillStyle(C.cream, Math.max(0, this.transition / 0.35));
      g.fillRect(0, 0, 1280, 720);
    }
    if (sim.deathDelay > 0) {
      g.fillStyle(
        C.ink,
        Math.sin(((0.85 - sim.deathDelay) / 0.85) * Math.PI) * 0.8,
      );
      g.fillRect(0, 0, 1280, 720);
    }
  }
}
