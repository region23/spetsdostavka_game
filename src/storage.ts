import { rooms } from "./rooms";
import type { Snapshot } from "./simulation";
import type { NarrativeSave } from "./narrative";
export const DEFAULT_KEYS = {
  left: "KeyA",
  right: "KeyD",
  jump: "Space",
  down: "KeyS",
  interact: "KeyE",
  seal: "KeyF",
};
export type Settings = {
  master: number;
  music: number;
  effects: number;
  speech: number;
  subtitles: boolean;
  reducedMotion: boolean;
  hints: boolean;
  keys: typeof DEFAULT_KEYS;
};
export const DEFAULT_SETTINGS: Settings = {
  master: 0.65,
  music: 0.35,
  effects: 0.6,
  speech: 0.7,
  subtitles: true,
  reducedMotion: false,
  hints: true,
  keys: { ...DEFAULT_KEYS },
};
export type Save = {
  snapshot: Snapshot;
  elapsed: number;
  deaths: number;
  helpUsed: boolean;
  completed: boolean;
  narrative?: NarrativeSave;
};
export class CheckpointService {
  available = true;
  warning = "";
  memory = new Map<string, string>();
  read(key: string): unknown {
    try {
      const raw = localStorage.getItem("spets-" + key) ?? this.memory.get(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      this.warning =
        "Сохранение недоступно или повреждено. Можно начать новую доставку.";
      const raw = this.memory.get(key);
      if (raw) {
        try {
          return JSON.parse(raw);
        } catch {}
      }
      return null;
    }
  }
  write(key: string, value: unknown) {
    const data = JSON.stringify(value);
    this.memory.set(key, data);
    try {
      localStorage.setItem("spets-" + key, data);
    } catch {
      this.available = false;
      this.warning = "Прогресс сохранится только до закрытия страницы.";
    }
  }
  save(value: Save) {
    this.write("save", value);
  }
  load(): Save | null {
    const v = this.read("save") as Save | null;
    if (!v) return null;
    try {
      const s = v.snapshot;
      if (
        s.version !== 1 ||
        !Number.isInteger(s.room) ||
        !rooms[s.room] ||
        typeof v.completed !== "boolean" ||
        !Number.isFinite(v.elapsed) ||
        v.elapsed < 0 ||
        !Number.isFinite(v.deaths)
      )
        throw Error();
      const finite = (a: unknown) =>
        typeof a === "number" && Number.isFinite(a) && Math.abs(a) < 100000;
      for (const key of [
        "x",
        "y",
        "vx",
        "vy",
        "coyote",
        "buffer",
        "drop",
        "poseTime",
      ] as const)
        if (!finite(s.player[key])) throw Error();
      if (
        ![true, false].includes(s.parcel.carried) ||
        ![true, false].includes(s.parcel.open) ||
        !finite(s.parcel.x) ||
        !finite(s.parcel.y)
      )
        throw Error();
      if (s.machines.length !== rooms[s.room].machines.length) throw Error();
      s.machines.forEach((m, i) => {
        if (
          m.id !== rooms[s.room].machines[i].id ||
          !finite(m.phase) ||
          m.phase < 0 ||
          m.phase >= 1 ||
          !finite(m.px) ||
          !finite(m.py)
        )
          throw Error();
      });
      if (
        !s.flags ||
        typeof s.flags.accepted !== "boolean" ||
        typeof s.flags.windowSent !== "boolean" ||
        typeof s.flags.opened !== "boolean"
      )
        throw Error();
      if (
        s.player.x < 0 ||
        s.player.x > 1280 ||
        s.player.y < 0 ||
        s.player.y > 720 ||
        typeof s.player.grounded !== "boolean" ||
        ![1, -1].includes(s.player.face) ||
        ![
          "idle",
          "run",
          "jump",
          "fall",
          "hang",
          "climb",
          "land",
          "interact",
        ].includes(s.player.pose) ||
        s.player.hang !== null
      )
        throw Error();
      if (
        s.player.support !== null &&
        !s.machines.some((m) => m.id === s.player.support)
      )
        throw Error();
      if (
        typeof s.completed !== "boolean" ||
        s.completed !== v.completed ||
        typeof s.parcel.delivered !== "boolean" ||
        typeof v.helpUsed !== "boolean"
      )
        throw Error();
      s.machines.forEach((m, i) => {
        const original = rooms[s.room].machines[i];
        for (const key of [
          "x",
          "y",
          "w",
          "h",
          "toX",
          "toY",
          "period",
          "kind",
          "compatible",
        ] as const)
          if (m[key] !== original[key]) throw Error();
        if (typeof m.stopped !== "boolean") throw Error();
        const t = (1 - Math.cos(m.phase * 2 * Math.PI)) / 2;
        if (
          Math.abs(m.px - (m.x + (m.toX - m.x) * t)) > 0.01 ||
          Math.abs(m.py - (m.y + (m.toY - m.y) * t)) > 0.01
        )
          throw Error();
      });
      return v;
    } catch {
      this.warning =
        "Сохранение повреждено. Начните новую доставку — настройки сохранены.";
      return null;
    }
  }
  settings(): Settings {
    const v = this.read("settings") as Partial<Settings> | null;
    const s = structuredClone(DEFAULT_SETTINGS);
    if (v) {
      for (const k of ["master", "music", "effects", "speech"] as const)
        if (typeof v[k] === "number") s[k] = Math.max(0, Math.min(1, v[k]!));
      for (const k of ["subtitles", "reducedMotion", "hints"] as const)
        if (typeof v[k] === "boolean") s[k] = v[k]!;
      if (
        v.keys &&
        Object.values(v.keys).length === 6 &&
        new Set(Object.values(v.keys)).size === 6 &&
        Object.values(v.keys).every(
          (k) =>
            k !== "KeyR" &&
            /^(Key[A-Z]|Digit[0-9]|Space|Arrow(Left|Right|Up|Down))$/.test(k),
        )
      )
        s.keys = { ...v.keys };
    }
    return s;
  }
}
