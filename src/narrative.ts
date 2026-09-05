export type NarrativeLine = { id: string; speaker: string; text: string };
const clips: Record<string, NarrativeLine[]> = {
  pickup: [
    { id: "dispatch-parcel", speaker: "Диспетчер, по рации", text: "Внутри новое расписание для Малого зала. Отнесите модуль к двери, в приёмный узел." },
  ],
  "seal-open": [
    { id: "seal-permission", speaker: "Диспетчер, по рации", text: "Пломба разрешает почтовым машинам остановиться. Этот порядок оставили для нестандартных грузов ещё при строительстве." },
  ],
  room1: [
    { id: "hall-rejected", speaker: "«Связь», объявление", text: "Перерыв отклонён. По реестру Малый зал не используется." },
    { id: "hall-neighbours", speaker: "Диспетчер, по рации", text: "Соседи сами привели зал в порядок. Уже стулья расставили, а в плане он всё ещё пустой." },
  ],
  room2: [
    { id: "bus-courier", speaker: "Курьер", text: "Автобусы тоже до сих пор ходят к закрытым предприятиям." },
    { id: "bus-dispatch", speaker: "Диспетчер, по рации", text: "Маршруты остались со времени Приёмки. Новые заявки возвращаются с отказом." },
  ],
  room3: [
    { id: "manual-route", speaker: "Диспетчер, по рации", text: "Для посылки здесь почтовое окно. Вам придётся пройти через служебный обход." },
  ],
  send: [
    { id: "parcel-sent", speaker: "Курьер", text: "Посылка прошла. Теперь моя очередь." },
  ],
  room4: [
    { id: "concert-seats", speaker: "Голос из зала", text: "Начнём, когда объявления выключат. Пока садитесь, мест хватит." },
  ],
  room5: [
    { id: "hall-still-empty", speaker: "«Связь», объявление", text: "По реестру зал пуст. Отключение объявлений не требуется." },
  ],
  delivered: [
    { id: "hall-accepted", speaker: "«Связь», приёмный узел", text: "Расписание принято. Малый зал открыт. Объявления отключены на пять минут." },
  ],
};
const linesById = new Map(Object.values(clips).flat().map(line => [line.id, line]));
export type NarrativeSave = { heard: string[] };

export class NarrativeController {
  private heard = new Set<string>();
  private queue: NarrativeLine[] = [];
  current: NarrativeLine | null = null;
  remaining = 0;
  private gap = 0;
  get subtitle() { return this.current ? `${this.current.speaker}: ${this.current.text}` : ""; }
  get history() { return [...this.heard].map(id => linesById.get(id)!); }
  snapshot(): NarrativeSave { return { heard: [...this.heard] }; }
  restore(value?: NarrativeSave) {
    this.reset();
    if (Array.isArray(value?.heard)) for (const id of value.heard) if (typeof id === "string" && linesById.has(id)) this.heard.add(id);
  }
  reset() { this.heard.clear(); this.queue = []; this.current = null; this.remaining = 0; this.gap = 0; }
  event(name: string, room: number) {
    const key = name === "room" ? name + room : name;
    // Room changes discard pending chatter, not the line currently being read.
    if (name === "room") this.queue = [];
    for (const line of clips[key] ?? []) {
      if (!this.heard.has(line.id) && !this.queue.some(pending => pending.id === line.id)) this.queue.push(line);
    }
    if (name === "delivered") {
      this.heard.add("hall-accepted");
      this.current = null;
      this.queue = [];
    }
  }
  update(dt: number, canStart = true): NarrativeLine | null {
    if (this.current) {
      this.remaining = Math.max(0, this.remaining - dt);
      if (this.remaining === 0) { this.current = null; this.gap = 1.5; }
      return null;
    }
    this.gap = Math.max(0, this.gap - dt);
    if (!canStart || this.gap > 0) return null;
    const next = this.queue.shift();
    if (!next) return null;
    this.current = next;
    this.heard.add(next.id);
    this.remaining = Math.max(5, next.text.split(/\s+/).length * 0.42 + 1.5);
    return next;
  }
}
