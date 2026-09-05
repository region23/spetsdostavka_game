export type Rect = { x: number; y: number; w: number; h: number };
export type Mechanism = Rect & {
  id: string;
  kind: "press" | "lift" | "carriage" | "conveyor";
  toX: number;
  toY: number;
  period: number;
  phase: number;
  compatible: boolean;
};
export type Room = {
  id: string;
  title: string;
  subtitle: string;
  family: "hall" | "shaft" | "club";
  start: { x: number; y: number };
  platforms: Rect[];
  machines: Mechanism[];
  exit: Rect;
  tip: string;
  signs: { x: number; y: number; text: string }[];
};
const floor = (x: number, w: number, y = 610, h = 110): Rect => ({
  x,
  y,
  w,
  h,
});
const m = (
  id: string,
  kind: Mechanism["kind"],
  x: number,
  y: number,
  w: number,
  h: number,
  toX: number,
  toY: number,
  period = 6,
  phase = 0,
): Mechanism => ({
  id,
  kind,
  x,
  y,
  w,
  h,
  toX,
  toY,
  period,
  phase,
  compatible: true,
});
export const rooms: Room[] = [
  {
    id: "dispatch",
    title: "Экспедиция",
    subtitle: "Главпочтамт · ручные маршруты",
    family: "hall",
    start: { x: 120, y: 610 },
    platforms: [floor(0, 245), floor(325, 955)],
    machines: [m("line", "conveyor", 700, 610, 245, 24, 700, 610, 3)],
    exit: { x: 1170, y: 510, w: 100, h: 100 },
    tip: "Посылка ждёт у стойки выдачи. Подойдите и нажмите E.",
    signs: [
      { x: 370, y: 410, text: "ВЫДАЧА  /  12-Б" },
    ],
  },
  {
    id: "sorting",
    title: "Сортировочный проход",
    subtitle: "Линия 04 · непрерывный цикл",
    family: "hall",
    start: { x: 100, y: 610 },
    platforms: [floor(0, 1280)],
    machines: [m("press", "press", 625, 275, 140, 165, 625, 450, 5.8, 0.5)],
    exit: { x: 1170, y: 510, w: 100, h: 100 },
    tip: "Понаблюдайте за циклом пресса. Остановленный механизм остаётся на месте.",
    signs: [
      { x: 900, y: 470, text: "МАЛЫЙ ЗАЛ  →" },
    ],
  },
  {
    id: "elevator",
    title: "Межэтажный подъёмник",
    subtitle: "Технический уровень · отметка +3,40",
    family: "shaft",
    start: { x: 120, y: 610 },
    platforms: [floor(0, 390), floor(650, 630, 380, 340)],
    machines: [m("lift", "lift", 405, 610, 190, 24, 405, 225, 8)],
    exit: { x: 1170, y: 280, w: 100, h: 100 },
    tip: "Закройте пломбу, чтобы подъёмник работал. Остановите его, когда платформа поднимется до полки.",
    signs: [
      { x: 780, y: 295, text: "+3,40  /  К МАЛОМУ ЗАЛУ  →" },
    ],
  },
  {
    id: "window",
    title: "Передаточное окно",
    subtitle: "Раздельный маршрут · отправления / персонал",
    family: "shaft",
    start: { x: 110, y: 610 },
    platforms: [floor(0, 540), floor(550, 175, 350, 370), floor(725, 555)],
    machines: [
      m("bypass", "lift", 320, 605, 170, 24, 320, 290, 7),
      m("receiving-press", "press", 755, 300, 115, 160, 755, 450, 6, 0.15),
    ],
    exit: { x: 1170, y: 510, w: 100, h: 100 },
    tip: "Откройте пломбу и передайте посылку через окно. Её поле удержит пресс, а дальний подъёмник продолжит работать.",
    signs: [
      { x: 120, y: 230, text: "ОБХОД ДЛЯ ПЕРСОНАЛА  ↑" },
      { x: 510, y: 470, text: "ПОЧТОВОЕ ОКНО" },
      { x: 905, y: 430, text: "ПРИЁМ ОТПРАВЛЕНИЙ" },
    ],
  },
  {
    id: "gallery",
    title: "Галерея клуба",
    subtitle: "Последний переход · музыка за стеной",
    family: "club",
    start: { x: 110, y: 610 },
    platforms: [floor(0, 325), floor(665, 210), floor(1070, 210, 365, 355)],
    machines: [
      m("bridge", "carriage", 345, 560, 145, 24, 530, 560, 6),
      m("club-lift", "lift", 900, 610, 150, 24, 900, 295, 7),
    ],
    exit: { x: 1170, y: 265, w: 100, h: 100 },
    tip: "Зафиксируйте каретку в середине разрыва. Затем дайте подъёмнику довезти вас до галереи.",
    signs: [
      { x: 1080, y: 275, text: "МАЛЫЙ ЗАЛ" },
    ],
  },
  {
    id: "auditorium",
    title: "Малый зал",
    subtitle: "Приёмный узел у двери зала",
    family: "club",
    start: { x: 120, y: 610 },
    platforms: [floor(0, 1280)],
    machines: [m("hall-line", "conveyor", 310, 610, 240, 24, 310, 610, 4)],
    exit: { x: 1060, y: 505, w: 100, h: 105 },
    tip: "Установите модуль расписания в приёмный узел. Здесь ждут пять минут тишины.",
    signs: [{ x: 690, y: 265, text: "ПОМЕЩЕНИЕ НЕ ИСПОЛЬЗУЕТСЯ" }],
  },
];
export function validateRooms() {
  const ids = new Set<string>();
  for (const r of rooms) {
    if (ids.has(r.id)) throw Error("Duplicate room");
    ids.add(r.id);
    if (r.platforms.length === 0) throw Error("No floor");
    const mids = new Set();
    for (const m of r.machines) {
      if (mids.has(m.id) || m.period <= 0) throw Error("Invalid mechanism");
      mids.add(m.id);
    }
    for (const p of [...r.platforms, ...r.machines, r.exit])
      if (![p.x, p.y, p.w, p.h].every(Number.isFinite) || p.w <= 0 || p.h <= 0)
        throw Error("Invalid geometry");
  }
}
