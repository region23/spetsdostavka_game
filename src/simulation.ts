import { rooms, type Rect, type Mechanism } from "./rooms";
export const STEP = 1 / 60,
  RADIUS = 220,
  PW = 34,
  PH = 88;
export type Input = {
  left?: boolean;
  right?: boolean;
  jump?: boolean;
  down?: boolean;
  interact?: boolean;
  seal?: boolean;
};
export type MachineState = Mechanism & {
  px: number;
  py: number;
  stopped: boolean;
};
export type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  face: number;
  grounded: boolean;
  support: string | null;
  coyote: number;
  buffer: number;
  hang: { x: number; y: number; dir: number; support?: string } | null;
  drop: number;
  pose: string;
  poseTime: number;
};
export type Parcel = {
  x: number;
  y: number;
  carried: boolean;
  open: boolean;
  delivered: boolean;
};
export type Snapshot = {
  version: 1;
  room: number;
  player: Player;
  parcel: Parcel;
  machines: MachineState[];
  flags: { accepted: boolean; windowSent: boolean; opened: boolean };
  completed: boolean;
};
const overlap = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const body = (p: Player): Rect => ({
  x: p.x - PW / 2,
  y: p.y - PH,
  w: PW,
  h: PH,
});
export function affected(parcel: Parcel, m: Rect) {
  return (
    parcel.open &&
    !parcel.delivered &&
    Math.hypot(
      parcel.x - Math.max(m.x, Math.min(parcel.x, m.x + m.w)),
      parcel.y - Math.max(m.y, Math.min(parcel.y, m.y + m.h)),
    ) <= RADIUS
  );
}
export function advanceMachine(m: MachineState, dt: number) {
  const ox = m.px,
    oy = m.py;
  if (!m.stopped) m.phase = (m.phase + dt / m.period) % 1;
  const t = (1 - Math.cos(m.phase * 2 * Math.PI)) / 2;
  m.px = m.x + (m.toX - m.x) * t;
  m.py = m.y + (m.toY - m.y) * t;
  return { x: m.px - ox, y: m.py - oy };
}
export class Simulation {
  roomIndex = 0;
  player!: Player;
  parcel!: Parcel;
  machines: MachineState[] = [];
  flags = { accepted: false, windowSent: false, opened: false };
  completed = false;
  events: string[] = [];
  checkpoint!: Snapshot;
  elapsed = 0;
  deaths = 0;
  helpUsed = false;
  roomTime = 0;
  deathDelay = 0;
  get room() {
    return rooms[this.roomIndex];
  }
  constructor() {
    this.loadRoom(0, false);
  }
  loadRoom(index: number, carry = true, open = false) {
    this.roomIndex = index;
    this.roomTime = 0;
    this.deathDelay = 0;
    const s = this.room.start;
    this.player = {
      ...s,
      vx: 0,
      vy: 0,
      face: 1,
      grounded: true,
      support: null,
      coyote: 0.1,
      buffer: 0,
      hang: null,
      drop: 0,
      pose: "idle",
      poseTime: 0,
    };
    this.parcel = { x: 435, y: 586, carried: carry, open, delivered: false };
    this.flags = { accepted: carry, windowSent: false, opened: open };
    this.machines = this.room.machines.map((m) => {
      const t = (1 - Math.cos(m.phase * 2 * Math.PI)) / 2;
      return {
        ...m,
        px: m.x + (m.toX - m.x) * t,
        py: m.y + (m.toY - m.y) * t,
        stopped: false,
      };
    });
    this.syncParcel();
    this.checkpoint = this.snapshot();
    this.events.push("room");
  }
  snapshot(): Snapshot {
    return structuredClone({
      version: 1,
      room: this.roomIndex,
      player: this.player,
      parcel: this.parcel,
      machines: this.machines,
      flags: this.flags,
      completed: this.completed,
    });
  }
  restore(s: Snapshot) {
    this.roomIndex = s.room;
    this.player = structuredClone(s.player);
    this.parcel = structuredClone(s.parcel);
    this.machines = structuredClone(s.machines);
    this.flags = { ...s.flags };
    this.completed = s.completed;
    this.roomTime = 0;
    this.deathDelay = 0;
    this.checkpoint = structuredClone(s);
    this.events.push("room");
  }
  restart() {
    this.restore(this.checkpoint);
    this.events.push("restored");
  }
  syncParcel() {
    if (this.parcel.carried) {
      this.parcel.x = this.player.x - this.player.face * 16;
      this.parcel.y = this.player.y - 43;
    }
  }
  nearParcel() {
    return (
      this.parcel.carried ||
      Math.hypot(
        this.player.x - this.parcel.x,
        this.player.y - 42 - this.parcel.y,
      ) < 85
    );
  }
  atWindow() {
    return (
      this.roomIndex === 3 &&
      this.player.x > 450 &&
      this.player.x < 550 &&
      this.player.y > 535
    );
  }
  atReceiver() {
    return this.roomIndex === 5 && Math.abs(this.player.x - 1100) < 85;
  }
  action(): { text: string; kind: string } | null {
    if (this.completed) return null;
    if (this.atReceiver() && this.parcel.carried)
      return { text: "Установить модуль", kind: "deliver" };
    if (this.atWindow()) {
      if (this.parcel.carried)
        return { text: "Передать через окно", kind: "send" };
      if (this.flags.windowSent)
        return { text: "Вернуть посылку через окно", kind: "recall" };
    }
    if (!this.parcel.carried && this.nearParcel())
      return {
        text: this.flags.accepted
          ? "Забрать посылку"
          : "Получить отправление №12-Б",
        kind: "pickup",
      };
    if (this.parcel.carried && this.player.grounded)
      return { text: "Положить посылку", kind: "put" };
    return null;
  }
  interact() {
    const a = this.action();
    if (!a) return;
    const p = this.player;
    switch (a.kind) {
      case "deliver":
        this.completed = true;
        this.parcel.carried = false;
        this.parcel.delivered = true;
        this.parcel.open = false;
        this.parcel.x = 1100;
        this.parcel.y = 548;
        this.events.push("delivered");
        break;
      case "send":
        this.parcel.carried = false;
        this.parcel.x = 805;
        this.parcel.y = 586;
        this.flags.windowSent = true;
        this.events.push("send");
        break;
      case "recall":
        this.parcel.carried = true;
        this.flags.windowSent = false;
        this.syncParcel();
        this.events.push("pickup");
        break;
      case "pickup":
        this.parcel.carried = true;
        this.syncParcel();
        if (!this.flags.accepted) {
          this.flags.accepted = true;
          this.checkpoint = this.snapshot();
          this.checkpoint.player = {
            ...this.checkpoint.player,
            x: 435,
            y: 610,
            vx: 0,
            vy: 0,
            grounded: true,
            support: null,
            coyote: 0.1,
            buffer: 0,
            hang: null,
            drop: 0,
            pose: "idle",
            poseTime: 0,
          };
          this.checkpoint.parcel = {
            ...this.checkpoint.parcel,
            x: 419,
            y: 567,
          };
          this.events.push("checkpoint");
        }
        this.events.push("pickup");
        break;
      case "put": {
        const x = p.x + p.face * 46;
        const surface = this.room.platforms.find(
          (r) =>
            x - 20 >= r.x && x + 20 <= r.x + r.w && Math.abs(p.y - r.y) < 3,
        );
        const placed = { x: x - 20, y: p.y - 35, w: 40, h: 35 };
        if (
          surface &&
          !this.room.platforms.some((r) => overlap(placed, r)) &&
          !this.machines.some((m) =>
            overlap(placed, { x: m.px, y: m.py, w: m.w, h: m.h }),
          )
        ) {
          this.parcel.carried = false;
          this.parcel.x = x;
          this.parcel.y = p.y - 24;
          this.events.push("put");
        } else this.events.push("unsafe");
        break;
      }
    }
  }
  die() {
    if (this.deathDelay) return;
    this.deaths++;
    this.deathDelay = 0.85;
    this.events.push("fall");
  }
  skip() {
    this.helpUsed = true;
    if (this.roomIndex < 5) this.loadRoom(this.roomIndex + 1, true, false);
    else {
      this.player.x = 1070;
      this.parcel.carried = true;
      this.syncParcel();
    }
    this.events.push("assisted");
  }
  step(input: Input, dt = STEP) {
    if (this.completed) return;
    this.elapsed += dt;
    if (this.deathDelay > 0) {
      this.deathDelay -= dt;
      if (this.deathDelay <= 0) this.restart();
      return;
    }
    this.roomTime += dt;
    const p = this.player;
    p.poseTime = Math.max(0, p.poseTime - dt);
    p.drop = Math.max(0, p.drop - dt);
    if (input.seal && this.nearParcel()) {
      this.parcel.open = !this.parcel.open;
      this.flags.opened = true;
      this.events.push(this.parcel.open ? "seal-open" : "seal-close");
    }
    if (input.interact && this.action()) {
      this.interact();
      p.poseTime = 0.25;
      p.pose = "interact";
      if (this.completed) return;
    }
    this.syncParcel();
    const moves = new Map<string, { x: number; y: number }>();
    for (const m of this.machines) {
      m.stopped =
        m.compatible &&
        affected(this.parcel, { x: m.px, y: m.py, w: m.w, h: m.h });
      moves.set(m.id, advanceMachine(m, dt));
    }
    if (p.support) {
      const d = moves.get(p.support);
      if (d) {
        p.x += d.x;
        p.y += d.y;
      }
    }
    if (p.hang?.support) {
      const d = moves.get(p.hang.support);
      if (d) {
        p.hang.x += d.x;
        p.hang.y += d.y;
        p.x += d.x;
        p.y += d.y;
      }
    }
    if (input.jump) p.buffer = 0.11;
    else p.buffer = Math.max(0, p.buffer - dt);
    if (p.hang) {
      p.vx = 0;
      p.vy = 0;
      if (input.down) {
        p.hang = null;
        p.drop = 0.3;
      } else if (input.jump) {
        p.x = p.hang.x + p.hang.dir * (PW / 2 + 5);
        p.y = p.hang.y;
        p.hang = null;
        p.grounded = true;
        p.buffer = 0;
        p.pose = "climb";
        p.poseTime = 0.25;
        this.events.push("climb");
      }
      this.syncParcel();
      return;
    }
    if (input.down && p.grounded && !p.support) {
      const surface = this.room.platforms.find(
        (r) => Math.abs(p.y - r.y) < 3 && p.x >= r.x && p.x <= r.x + r.w,
      );
      if (surface) {
        const edge = p.face > 0 ? surface.x + surface.w : surface.x;
        if (
          Math.abs(p.x - edge) < 30 &&
          !this.room.platforms.some(
            (r) =>
              r !== surface &&
              edge >= r.x &&
              edge <= r.x + r.w &&
              Math.abs(r.y - p.y) < 3,
          )
        ) {
          const dir = -p.face;
          p.hang = { x: edge, y: surface.y, dir };
          p.x = edge - dir * (PW / 2 + 1);
          p.y = surface.y + PH - 12;
          p.face = dir;
          p.grounded = false;
          p.vx = 0;
          p.vy = 0;
          p.pose = "hang";
          this.syncParcel();
          return;
        }
      }
    }
    if (input.down && p.grounded && p.support) {
      p.y += 30;
      p.grounded = false;
      p.support = null;
      p.drop = 0.3;
    }
    if (p.grounded) p.coyote = 0.1;
    else p.coyote = Math.max(0, p.coyote - dt);
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -640;
      p.grounded = false;
      p.support = null;
      p.coyote = 0;
      p.buffer = 0;
      this.events.push("jump");
    }
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    if (direction) p.face = direction;
    const target = direction * 270;
    const accel = direction ? 1900 : 2450;
    p.vx += Math.max(-accel * dt, Math.min(accel * dt, target - p.vx));
    const obstacles = [
      ...this.room.platforms.map((r, i) => ({
        ...r,
        id: "s" + i,
        kind: "static",
      })),
      ...this.machines
        .filter((m) => m.kind !== "conveyor")
        .map((m) => ({
          x: m.px,
          y: m.py,
          w: m.w,
          h: m.h,
          id: m.id,
          kind: m.kind,
        })),
    ];
    const ox = p.x,
      oy = p.y;
    const wasGrounded = p.grounded;
    p.x += p.vx * dt;
    p.x = Math.max(PW / 2, Math.min(1260, p.x));
    // The marked service turnstile admits the courier after the parcel has used its own route.
    if (
      this.roomIndex === 3 &&
      !this.flags.windowSent &&
      p.x > 521 &&
      p.y < 440
    ) {
      p.x = 521;
      p.vx = 0;
      if (this.roomTime % 2 < dt) this.events.push("service-gate");
    }
    for (const r of obstacles) {
      if (overlap(body(p), r)) {
        if (ox + PW / 2 <= r.x + 3) {
          p.x = r.x - PW / 2;
          p.vx = 0;
        } else if (ox - PW / 2 >= r.x + r.w - 3) {
          p.x = r.x + r.w + PW / 2;
          p.vx = 0;
        }
      }
    }
    p.vy = Math.min(850, p.vy + 1600 * dt);
    p.y += p.vy * dt;
    p.grounded = false;
    p.support = null;
    for (const r of obstacles) {
      if (p.x + PW / 2 <= r.x || p.x - PW / 2 >= r.x + r.w) continue;
      if (
        p.vy >= 0 &&
        oy <= r.y + 6 &&
        p.y >= r.y &&
        !(p.drop > 0 && r.kind !== "static")
      ) {
        p.y = r.y;
        p.vy = 0;
        p.grounded = true;
        p.support = r.kind === "static" ? null : r.id;
      } else if (overlap(body(p), r)) {
        if (
          r.kind === "press" &&
          !this.machines.find((m) => m.id === r.id)?.stopped
        ) {
          this.die();
          return;
        }
        if (oy - PH >= r.y + r.h - 4 && p.vy < 0) {
          p.y = r.y + r.h + PH;
          p.vy = 0;
        } else if (p.y > r.y + 8 && p.y - PH < r.y + r.h - 8) {
          p.x = ox;
        }
      }
    }
    for (const m of this.machines) {
      if (
        m.kind === "press" &&
        !m.stopped &&
        overlap(body(p), { x: m.px + 2, y: m.py, w: m.w - 4, h: m.h })
      ) {
        this.die();
        return;
      }
      if (
        m.kind === "conveyor" &&
        !m.stopped &&
        p.grounded &&
        p.x > m.px &&
        p.x < m.px + m.w &&
        Math.abs(p.y - m.py) < 4
      )
        p.x -= 95 * dt;
    }
    // Ledge catch requires a free standing volume above the edge.
    if (!p.grounded && p.vy > 0 && p.drop === 0) {
      for (const r of obstacles.filter((r) => r.kind !== "press")) {
        if (this.roomIndex === 3 && !this.flags.windowSent && r.x === 550)
          continue;
        const edge = p.face > 0 ? r.x : r.x + r.w;
        const hands = p.y - PH + 12;
        const stand = {
          x: p.face > 0 ? edge + 3 : edge - PW - 3,
          y: r.y - PH,
          w: PW,
          h: PH - 1,
        };
        if (
          Math.abs(p.x + (p.face * PW) / 2 - edge) < 13 &&
          Math.abs(hands - r.y) < 18 &&
          !obstacles.some((o) => o !== r && overlap(stand, o))
        ) {
          p.hang = {
            x: edge,
            y: r.y,
            dir: p.face,
            support: r.kind === "static" ? undefined : r.id,
          };
          p.x = edge - p.face * (PW / 2 + 1);
          p.y = r.y + PH - 12;
          p.vy = 0;
          p.pose = "hang";
          this.events.push("grab");
          break;
        }
      }
    }
    if (!wasGrounded && p.grounded) {
      this.events.push("land");
      p.pose = "land";
      p.poseTime = 0.12;
    }
    if (p.poseTime === 0)
      p.pose = p.hang
        ? "hang"
        : !p.grounded
          ? p.vy < 0
            ? "jump"
            : "fall"
          : Math.abs(p.vx) > 15
            ? "run"
            : "idle";
    this.syncParcel();
    if (p.y > 790 || this.parcel.y > 760) {
      this.die();
      return;
    }
    if (this.roomIndex < 5 && overlap(body(p), this.room.exit)) {
      if (this.parcel.carried) {
        this.loadRoom(this.roomIndex + 1, true, this.parcel.open);
      } else if (this.roomTime % 2 < dt) this.events.push("need-parcel");
    }
  }
}
