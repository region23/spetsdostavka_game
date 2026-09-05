import type { Settings } from "./storage";
export class AudioController {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  hum: GainNode | null = null;
  mode = "silent";
  beat = 0;
  next = 0;
  settings: Settings;
  constructor(settings: Settings) {
    this.settings = settings;
  }
  async unlock() {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.hum = this.ctx.createGain();
        this.hum.gain.value = 0;
        this.hum.connect(this.master);
        for (const f of [55, 82.4]) {
          const osc = this.ctx.createOscillator();
          osc.type = "triangle";
          osc.frequency.value = f;
          osc.connect(this.hum);
          osc.start();
        }
      }
      await this.ctx.resume();
      this.apply();
    } catch {
      /* Audio is optional. */
    }
  }
  apply() {
    if (this.ctx && this.master)
      this.master.gain.setTargetAtTime(
        this.settings.master,
        this.ctx.currentTime,
        0.06,
      );
  }
  tone(
    freq: number,
    duration: number,
    gain: number,
    type: OscillatorType = "sine",
    delay = 0,
  ) {
    if (!this.ctx || !this.master) return;
    try {
      const now = this.ctx.currentTime + delay,
        o = this.ctx.createOscillator(),
        g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      o.connect(g);
      g.connect(this.master);
      o.start(now);
      o.stop(now + duration + 0.02);
    } catch {}
  }
  effect(name: string) {
    const bank: Record<string, [number, number]> = {
      jump: [240, 0.12],
      land: [85, 0.12],
      grab: [170, 0.08],
      climb: [190, 0.14],
      pickup: [380, 0.18],
      put: [180, 0.1],
      send: [420, 0.22],
      "seal-open": [620, 0.5],
      "seal-close": [310, 0.3],
      fall: [85, 0.45],
      restored: [340, 0.25],
      room: [480, 0.2],
      delivered: [520, 0.8],
      step: [100, 0.04],
      click: [720, 0.05],
      hover: [540, 0.04],
      unsafe: [150, 0.1],
      pause: [220, 0.1],
      resume: [330, 0.1],
      hint: [440, 0.2],
      window: [370, 0.1],
      stamp: [100, 0.25],
      door: [160, 0.3],
      bell: [880, 0.5],
      paper: [180, 0.08],
    };
    const [f, d] = bank[name] ?? [200, 0.1];
    this.tone(
      f,
      d,
      this.settings.effects * 0.12,
      name === "step" ? "triangle" : "sine",
    );
    if (name === "seal-open" || name === "delivered")
      this.tone(f * 1.5, d * 1.5, this.settings.effects * 0.08, "sine", 0.08);
  }
  update(mode: string, machineLevel = 0) {
    this.mode = mode;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.hum?.gain.setTargetAtTime(
      mode === "game" ? machineLevel * this.settings.effects * 0.07 : 0,
      t,
      0.1,
    );
    if (mode === "silent") return;
    if (t > this.next) {
      const menu = [48, 55, 60, 64, 55, 60, 67, 64],
        game = [48, 0, 55, 0, 60, 0, 55, 0],
        final = [60, 64, 67, 64, 62, 65, 69, 0, 62, 60, 64, 67];
      const notes = mode === "final" ? final : mode === "menu" ? menu : game;
      const note = notes[this.beat++ % notes.length];
      if (note) {
        const f = 440 * 2 ** ((note - 69) / 12);
        const gain = this.settings.music * (mode === "final" ? 0.22 : 0.08);
        this.tone(f, 1.6, gain);
        this.tone(f * 2, 0.65, gain * 0.22);
      }
      this.next = t + (mode === "final" ? 0.57 : 0.7);
    }
  }
  speak(text: string) {
    try {
      if (
        this.settings.speech > 0 &&
        this.settings.master > 0 &&
        "speechSynthesis" in window
      ) {
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "ru-RU";
        u.rate = 0.92;
        u.volume = this.settings.speech * this.settings.master;
        speechSynthesis.speak(u);
      }
    } catch {}
  }
  hush() {
    this.update("silent");
    try {
      speechSynthesis.cancel();
    } catch {}
  }
}
