import * as Phaser from "phaser";
import "./style.css";
import "./mobile.css";
import { assetURL } from "./assets";
import { Simulation, STEP, RADIUS, PW, PH, type Input } from "./simulation";
import { rooms, validateRooms } from "./rooms";
import {
  CheckpointService,
  DEFAULT_KEYS,
  type Settings,
  type Save,
} from "./storage";
import { AudioController } from "./audio";
import { GameScene } from "./scene";
import { NarrativeController } from "./narrative";
import { INTRO_VERSION, introPages, loreNotes } from "./lore";
import { TouchInput, touchControls, touchDevice } from "./touch";
const narrative = new NarrativeController();
export const store = new CheckpointService();
export const settings = store.settings();
export const sound = new AudioController(settings);
export const sim = new Simulation();
export let mode = "loading";
let previous = "menu";
let introPage = 0;
let introDestination: "brief" | "continue" | "menu" = "brief";
let journalReturn = "pause";
let save: Save | null = store.load();
let binding: keyof typeof DEFAULT_KEYS | null = null;
let endingTime = 0;
let accumulator = 0;
let statusTime = 0;
let lastStep = 0;
const ui = document.querySelector<HTMLElement>("#ui")!;
const toastEl = document.querySelector<HTMLElement>("#toast")!;
const held = new Set<string>();
const pressed = new Set<string>();
const touch = new TouchInput(ui, () => mode === "game", () => { void sound.unlock(); });
const bound = (
  set: Set<string>,
  action: keyof typeof DEFAULT_KEYS,
  fallback?: string,
) =>
  set.has(settings.keys[action]) ||
  (!!fallback &&
    !Object.values(settings.keys).includes(fallback) &&
    set.has(fallback));
export const keyLabel = (key: string) =>
  key === "Space"
    ? "Пробел"
    : key
        .replace("Key", "")
        .replace("Digit", "")
        .replace("ArrowLeft", "←")
        .replace("ArrowRight", "→")
        .replace("ArrowDown", "↓")
        .replace("ArrowUp", "↑");
const emblem = `<svg class="emblem" viewBox="0 0 96 52" aria-hidden="true"><path d="M29 16h38v25H29zM29 17l19 14 19-14M29 24H11L1 13h28M29 33H17l-8-8M67 24h18l10-11H67M67 33h12l8-8"/></svg>`;
const button = (id: string, text: string, cls = "") =>
  `<button data-action="${id}" class="${cls}">${text}</button>`;
const smallBrand = `<div class="small-brand">${emblem}<span>СПЕЦДОСТАВКА</span></div>`;
export function toast(message: string) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  statusTime = 5;
}
export function persist(completed = false) {
  save = {
    snapshot: structuredClone(sim.checkpoint),
    elapsed: sim.elapsed,
    deaths: sim.deaths,
    helpUsed: sim.helpUsed,
    completed,
    narrative: narrative.snapshot(),
  };
  if (completed) {
    save.snapshot = sim.snapshot();
    save.snapshot.completed = true;
  }
  store.save(save);
  if (!store.available) toast(store.warning);
}
function setMode(next: string) {
  mode = next;
  touch.clear();
  held.clear();
  pressed.clear();
  accumulator = 0;
  document.body.dataset.mode = next;
  renderUI();
  if (next !== "game" && next !== "ending") sound.hush();
}
export function ready() {
  if (mode === "error") return;
  const seen = store.read("splash");
  if (seen) {
    setMode("menu");
    return;
  }
  setMode("splash");
  setTimeout(() => {
    if (mode === "splash") {
      store.write("splash", true);
      setMode("menu");
    }
  }, 1050);
}
export function assetError() {
  touch.clear();
  mode = "error";
  renderUI();
}
export function progress(value: number) {
  const bar = document.querySelector<HTMLElement>(".loading-fill");
  if (bar) bar.style.width = `${Math.round(value * 100)}%`;
  const n = document.querySelector("#progress");
  if (n) n.textContent = `${Math.round(value * 100)}%`;
}
function newGame() {
  narrative.reset();
  sim.events = [];
  sim.elapsed = 0;
  sim.deaths = 0;
  sim.completed = false;
  sim.helpUsed = false;
  sim.loadRoom(0, false);
  persist();
  setMode("game");
}
function openIntro(destination: typeof introDestination) {
  introPage = 0;
  introDestination = destination;
  setMode("intro");
}
function finishIntro() {
  store.write("intro", INTRO_VERSION);
  if (introDestination === "continue") continueGame();
  else setMode(introDestination);
}
function startDelivery() {
  if (store.read("intro") === INTRO_VERSION) setMode("brief");
  else openIntro("brief");
}
function continueGame() {
  if (!save || save.completed) {
    setMode("brief");
    return;
  }
  if (store.read("intro") !== INTRO_VERSION) {
    openIntro("continue");
    return;
  }
  sim.restore(save.snapshot);
  sim.elapsed = save.elapsed;
  sim.deaths = save.deaths;
  sim.helpUsed = save.helpUsed;
  narrative.restore(save.narrative);
  setMode("game");
}
export function pause() {
  if (mode === "game") {
    persist();
    setMode("pause");
  } else if (mode === "ending") {
    previous = "ending";
    setMode("pause-ending");
  }
}
const controls = () =>
  `<div class="control-list"><span><kbd>${keyLabel(settings.keys.left)}</kbd><kbd>${keyLabel(settings.keys.right)}</kbd> движение</span><span><kbd>${controlLabel("jump")}</kbd> прыжок</span><span><kbd>${controlLabel("interact")}</kbd> посылка</span><span><kbd>${controlLabel("seal")}</kbd> пломба</span></div>`;
const controlLabel = (action: "jump" | "down" | "interact" | "seal") => touchDevice
  ? { jump: "Прыжок", down: "Спуск", interact: "Посылка", seal: "Пломба" }[action]
  : keyLabel(settings.keys[action]);
const roomTip = () => sim.room.tip.replaceAll(" E", touchDevice ? ' кнопку «Посылка»' : ` ${controlLabel("interact")}`);
function settingsHTML() {
  const labels = {
    master: "Общая громкость",
    music: "Музыка",
    effects: "Эффекты",
    speech: "Речь",
  };
  const toggles = {
    subtitles: "Субтитры",
    reducedMotion: "Уменьшить движение",
    hints: "Подсказки на маршруте",
  };
  const actions = {
    left: "Влево",
    right: "Вправо",
    jump: "Прыжок / подъём",
    down: "Спуск",
    interact: "Взаимодействие",
    seal: "Открыть пломбу",
  };
  return `<div class="sheet settings-sheet"><div class="eyebrow">ЗВУК И УПРАВЛЕНИЕ</div><h2>Настройки</h2><div class="settings-grid"><section>${Object.entries(
    labels,
  )
    .map(
      ([key, label]) =>
        `<label class="slider-label">${label}<output>${Math.round(settings[key as keyof typeof labels] * 100)}%</output><input aria-label="${label}" data-setting="${key}" type="range" min="0" max="1" step=".05" value="${settings[key as keyof typeof labels]}"></label>`,
    )
    .join("")}${Object.entries(toggles)
    .map(
      ([key, label]) =>
        `<label class="toggle-label">${label}<input type="checkbox" data-setting="${key}" ${settings[key as keyof typeof toggles] ? "checked" : ""}></label>`,
    )
    .join(
      "",
    )}</section><section>${touchDevice ? '<p class="fine">Экранные кнопки: удерживайте стрелку для движения, другой рукой нажимайте действие. Поворот телефона ставит игру на паузу.</p>' : ""}<details class="keyboard-settings" ${touchDevice ? "" : "open"}><summary>Клавиатура</summary>${Object.entries(
    actions,
  )
    .map(
      ([key, label]) =>
        `<div class="binding"><span>${label}</span><button data-bind="${key}">${binding === key ? "Нажмите клавишу…" : keyLabel(settings.keys[key as keyof typeof actions])}</button></div>`,
    )
    .join(
      "",
    )}<p class="fine">Стрелки также работают. Esc — пауза, R — повтор, F2 — отладка.</p>${button("reset-keys", "По умолчанию", "text-button")}</details>${document.fullscreenEnabled ? button("fullscreen", "⛶ Полный экран", "text-button") : ""}</section></div>${button("back", "Готово", "primary")}</div>`;
}
function introHTML() {
  const page = introPages[introPage];
  return `<section class="intro-screen" aria-label="Знакомство с городом"><div class="intro-art"><img src="${assetURL(page.image)}" alt=""><span>${page.caption}</span></div><div class="intro-copy-panel"><div class="eyebrow">ПРОСПЕКТ · ${introPage + 1} / ${introPages.length}</div><h2>${page.title}</h2>${page.paragraphs.map(text => `<p>${text}</p>`).join("")}<div class="intro-pagination" aria-label="Кадры вступления">${introPages.map((_, i) => `<span class="${i === introPage ? "current" : ""}"></span>`).join("")}</div><nav class="intro-actions">${button("intro-next", introPage === introPages.length - 1 ? (introDestination === "menu" ? "В меню" : introDestination === "continue" ? "Продолжить доставку" : "К отправлению") : "Дальше", "primary")}${introPage > 0 ? button("intro-back", "Назад", "text-button") : ""}${button("intro-skip", introDestination === "menu" ? "Закрыть" : "Пропустить вступление", "text-button")}</nav><p class="intro-footnote">Можно читать в своём темпе. Вступление доступно в меню «О городе».</p></div></section>`;
}
function journalHTML() {
  const notes = loreNotes.filter(note => note.room <= sim.roomIndex);
  return `<section class="sheet journal-sheet"><div class="eyebrow">ЗАПИСИ КУРЬЕРА</div><h2>Что происходит в городе</h2><p class="journal-mission">${sim.completed ? "Модуль доставлен. Объявления в Малом зале отключены на пять минут." : "Вы несёте новое расписание в Малый зал Главпочтамта. Оно разрешит перерыв на время концерта."}</p><div class="journal-notes">${notes.map(note => `<article><h3>${note.title}</h3><p>${note.text}</p></article>`).join("")}</div>${sim.roomIndex < 4 ? '<p class="fine">Дальше по маршруту появятся другие записи.</p>' : ""}${narrative.history.length ? `<details class="journal-transcript"><summary>Разговоры на маршруте (${narrative.history.length})</summary>${narrative.history.map(line => `<p><strong>${line.speaker}</strong><br>${line.text}</p>`).join("")}</details>` : ""}${button("journal-back", "Назад", "primary")}</section>`;
}
function renderUI() {
  // Keep the live status node when rebuilding the overlay.
  document.querySelector("#app")!.append(toastEl);
  ui.className = mode === "game" || mode === "ending" ? "playing" : "";
  switch (mode) {
    case "loading":
      ui.innerHTML = `<div class="loading-screen">${emblem}<div class="eyebrow">СПЕЦДОСТАВКА</div><h2>Подготовка маршрута</h2><div class="loading-track"><div class="loading-fill"></div></div><span id="progress">0%</span></div>`;
      break;
    case "error":
      ui.innerHTML = `<div class="sheet"><div class="eyebrow">МАРШРУТ НЕДОСТУПЕН</div><h2>Не удалось загрузить материалы</h2><p>Проверьте соединение и попробуйте ещё раз.</p>${button("reload", "Повторить загрузку", "primary")}</div>`;
      break;
    case "unsupported":
      ui.innerHTML = `<div class="sheet">${smallBrand}<h2>Браузер не поддерживает игру</h2><p>Попробуйте открыть ссылку в актуальной версии Safari или Chrome.</p></div>`;
      break;
    case "splash":
      ui.innerHTML = `<button class="splash" data-action="splash">${emblem}<strong>СПЕЦДОСТАВКА</strong><span>Люди не должны терять связь</span></button>`;
      break;
    case "menu":
      ui.innerHTML = `<div class="menu"><header>${smallBrand}</header><div class="menu-copy"><div class="eyebrow"><i></i> ГОРОДСКАЯ ПОЧТА</div><h1>СПЕЦ<br>ДОСТАВКА<span>®</span></h1><p class="tagline">Будущее нуждается в правках.</p><p class="intro-copy">В Малом зале готовятся к концерту.<br>Доставьте расписание, которое остановит шумную линию.</p><nav>${button(save && !save.completed ? "continue" : "start", save ? (save.completed ? "Повторить доставку" : "Продолжить доставку") : "Начать доставку", "primary large")}<div class="menu-secondary">${button("city", "О городе", "text-button")}${button("settings", "Настройки", "text-button")}${button("about", "Об игре", "text-button")}</div></nav><div class="mission-mini"><span>12-Б</span><div><strong>«Перерыв»</strong></div><em>Маршрут<br>3–5 мин</em></div></div><div class="poster" aria-hidden="true"><div class="poster-circle"></div><div class="poster-orbit"></div><img src="${scene.menuBagURL || assetURL("parcel.png")}" alt=""><span class="poster-number">12-Б</span></div><footer><span>ЛЮДИ НЕ ДОЛЖНЫ ТЕРЯТЬ СВЯЗЬ</span></footer></div>`;
      if (store.warning) toast(store.warning);
      break;
    case "intro":
      ui.innerHTML = introHTML();
      break;
    case "journal":
      ui.innerHTML = journalHTML();
      break;
    case "brief":
      ui.innerHTML = `<div class="brief sheet"><div class="eyebrow">ЗАДАНИЕ КУРЬЕРУ · №12-Б</div><h2>Перерыв для Малого зала</h2><blockquote>«У нас сегодня первый концерт. Автоматика перекрикивает даже пианино. Нам нужны пять минут».<cite>Заявка жителей из Малого зала</cite></blockquote><div class="brief-address"><span>КУДА НЕСТИ</span><strong>Малый зал Главпочтамта</strong><span>ЧТО ВНУТРИ</span><strong>Модуль с новым расписанием</strong></div><p class="brief-task">Установите модуль в приёмный узел у двери зала. Он разрешит остановить объявления и сортировку на пять минут.</p><div class="rule-note"><b>Ⅱ</b><p>Пока идёте, открывайте пломбу ${touchDevice ? "кнопкой" : "клавишей"} <kbd>${controlLabel("seal")}</kbd>. Она останавливает почтовые машины рядом с посылкой. Закроете пломбу, и они продолжат работу.</p></div>${button("accept", "Принять доставку →", "primary")}${button("menu", "В меню", "text-button")}</div>`;
      break;
    case "game":
      ui.innerHTML = `<div class="hud-top"><div class="hud-parcel"><span class="parcel-number">12-Б</span><div><small>СПЕЦДОСТАВКА</small><strong id="hud-state">ПЛОМБА ЗАКРЫТА</strong></div><span class="seal-state" id="seal-icon">▶</span></div><div class="room-label"><small id="room-number"></small><strong id="room-title"></strong></div><button class="pause-button" data-action="pause" aria-label="Пауза">Ⅱ <span>ESC</span></button></div><div id="chapter-intro"></div><div class="hud-bottom"><div class="hud-info">${controls()}<div id="subtitle" role="status"></div></div><div id="context"></div></div>${touchDevice ? touchControls() : ""}`;
      updateHUD();
      break;
    case "pause":
    case "pause-ending":
      ui.innerHTML = `<div class="sheet pause-sheet"><div class="eyebrow">ПОСЫЛКА №12-Б</div><h2>Доставка приостановлена</h2><p>Доставьте новое расписание в Малый зал.<br>Открытая пломба останавливает ближайшие почтовые машины.</p><div class="stack">${button("resume", "Продолжить", "primary")}${button("journal", "Записи о городе")}${mode === "pause" ? button("restart", "Повторить комнату") + button("help", "Помощь") : ""}${button("settings", "Настройки")}${button("menu", "В меню", "text-button")}</div></div>`;
      break;
    case "restart":
      ui.innerHTML = `<div class="sheet"><div class="eyebrow">БЕЗОПАСНАЯ ТОЧКА</div><h2>Повторить комнату?</h2><p>Герой, посылка и механизмы вернутся к началу текущей комнаты. Предыдущие комнаты уже пройдены.</p>${button("confirm-restart", "Повторить", "primary")}${button("cancel-restart", "Назад", "text-button")}</div>`;
      break;
    case "help":
      ui.innerHTML = `<div class="sheet help-sheet"><div class="eyebrow">ПАМЯТКА КУРЬЕРА</div><h2>Как работает пломба</h2><div class="rule-diagram"><div class="diagram-field"><span>12-Б</span><b>Ⅱ</b><i>Ⅱ</i></div><div class="diagram-lift">↑<small>ДВИЖЕТСЯ</small></div></div><p>${roomTip()}</p><p class="fine">${controlLabel("seal")} — переключить пломбу. ${controlLabel("interact")} — оставить или забрать груз. Поле действует и через стену. Висите на краю? ${controlLabel("jump")} — подняться, ${controlLabel("down")} — отпустить.</p>${button("resume", "Вернуться на маршрут", "primary")}${button("skip", "Пропустить препятствие", "text-button")}<p class="fine">Вы продолжите со следующей комнаты вместе с посылкой.</p></div>`;
      break;
    case "settings":
      ui.innerHTML = settingsHTML();
      break;
    case "about":
      ui.innerHTML = `<div class="sheet about-sheet">${smallBrand}<h2>О Спецдоставке</h2><p>Вы работаете курьером в Проспекте. Городская автоматика перестала принимать обновления, и заверенные посылки приходится доставлять лично.</p><p>В первой доставке жители просят остановить шумную линию рядом с их концертным залом. По пути посылка поможет вам управлять почтовыми машинами.</p><nav class="project-links" aria-label="Автор и исходный код"><a href="https://t.me/pavlenkodev" target="_blank" rel="noopener noreferrer"><strong>Блог автора ↗</strong><span>Павел — о разработке и этой игре</span></a><a href="https://github.com/region23/spetsdostavka_game" target="_blank" rel="noopener noreferrer"><strong>Исходный код на GitHub ↗</strong><span>Код игры открыт: можно заглянуть внутрь</span></a></nav><details class="credits"><summary>Авторы и материалы</summary><p class="fine">Концепция: «Спецдоставка», ТЗ 2.0. Разработка и оформление: Codex по заданию Павла. Иллюстрации созданы генератором изображений OpenAI. Музыка и эффекты синтезируются в браузере. Для реплик используются голоса устройства.</p><p class="fine">Phaser 4, TypeScript, Vite. Сведения о происхождении материалов и лицензии библиотек включены в проект.</p></details>${button("city", "О городе", "primary")}${button("menu", "В меню", "text-button")}</div>`;
      break;
    case "ending":
      ui.innerHTML = `<div class="ending-caption"><div class="eyebrow">МАЛЫЙ ЗАЛ · ГЛАВПОЧТАМТ</div><h2>Зал открыт.</h2><p id="ending-line">«Спасибо. Мы уже думали, что опять придётся переносить».</p><button data-action="receipt" class="text-button">К квитанции →</button></div>`;
      break;
    case "receipt": {
      const minutes = Math.floor(sim.elapsed / 60),
        seconds = Math.floor(sim.elapsed % 60)
          .toString()
          .padStart(2, "0");
      ui.innerHTML = `<div class="sheet receipt"><div class="eyebrow">СЛУЖБА СПЕЦДОСТАВКИ · КВИТАНЦИЯ №12-Б</div>${emblem}<h2>Доставлено<br><em>лично.</em></h2><div class="receipt-stamp">ПРИНЯТО<br><span>МАЛЫЙ ЗАЛ</span></div><div class="brief-address"><span>АДРЕСАТ</span><strong>Малый зал Главпочтамта</strong><span>РЕЗУЛЬТАТ</span><strong>Зал зарегистрирован. Перерыв разрешён.</strong><span>В ПУТИ</span><strong>${minutes}:${seconds} активного времени</strong></div><p>Малый зал внесён в расписание.<br>Объявления отключены на пять минут.</p>${button("start", "Повторить доставку", "primary")}${button("journal", "Записи о городе", "text-button")}${button("menu", "Закончить смену", "text-button")}</div>`;
      break;
    }
  }
  if (mode === "game") ui.querySelector(".hud-info")!.append(toastEl);
  if (mode === "intro") requestAnimationFrame(() => ui.querySelector<HTMLButtonElement>('[data-action="intro-next"]')?.focus({ preventScroll: true }));
  else if (mode !== "game" && mode !== "ending")
    requestAnimationFrame(() =>
      ui
        .querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true }),
    );
}
function updateHUD() {
  if (mode !== "game") return;
  const set = (id: string, text: string) => {
    const el = document.getElementById(id);
    if (el && el.textContent !== text) el.textContent = text;
  };
  set("room-title", sim.room.title);
  set(
    "room-number",
    `${String(sim.roomIndex + 1).padStart(2, "0")} / 06  ·  ГЛАВПОЧТАМТ`,
  );
  set(
    "hud-state",
    !sim.flags.accepted
      ? "ПОЛУЧИТЕ ОТПРАВЛЕНИЕ"
      : sim.parcel.open
        ? "ПЕРЕРЫВ · ПЛОМБА ОТКРЫТА"
        : "ПЛОМБА ЗАКРЫТА",
  );
  set("seal-icon", sim.parcel.open ? "Ⅱ" : "▶");
  document
    .querySelector(".hud-parcel")
    ?.classList.toggle("active", sim.parcel.open);
  const a = sim.action();
  const parcelButton = ui.querySelector<HTMLButtonElement>('[data-control="interact"]');
  if (parcelButton) {
    const label = a?.text || "Посылка";
    const shortLabel = a
      ? ({ pickup: "Взять", put: "Оставить", send: "Передать", recall: "Вернуть", deliver: "Вручить" }[a.kind] || "Посылка")
      : "Посылка";
    const text = parcelButton.querySelector("span")!;
    if (text.textContent !== shortLabel) text.textContent = shortLabel;
    if (parcelButton.getAttribute("aria-label") !== label) parcelButton.setAttribute("aria-label", label);
    parcelButton.classList.toggle("available", !!a);
  }
  const sealButton = ui.querySelector<HTMLButtonElement>('[data-control="seal"]');
  if (sealButton?.getAttribute("aria-pressed") !== String(sim.parcel.open)) {
    sealButton?.setAttribute("aria-pressed", String(sim.parcel.open));
    sealButton?.setAttribute("aria-label", sim.parcel.open ? "Закрыть пломбу" : "Открыть пломбу");
  }
  const context = document.querySelector("#context");
  if (context) {
    let text = "";
    if (sim.player.hang)
      text = `<kbd>${controlLabel("jump")}</kbd> Подняться · <kbd>${controlLabel("down")}</kbd> Спуститься`;
    else if (a && a.kind !== "put")
      text = `<kbd>${controlLabel("interact")}</kbd> ${a.text}`;
    else if (settings.hints && sim.nearParcel())
      text = `<kbd>${controlLabel("seal")}</kbd> ${sim.parcel.open ? "Закрыть" : "Открыть"} пломбу${!sim.parcel.carried ? " у посылки" : ""}`;
    if (context.innerHTML !== text) context.innerHTML = text;
  }
  const sub = document.querySelector("#subtitle");
  if (sub) {
    let text = "";
    if (settings.subtitles && narrative.subtitle) text = narrative.subtitle;
    else if (settings.hints && sim.roomTime > 25)
      text = roomTip();
    else if (settings.hints && sim.roomIndex === 0 && sim.roomTime < 20)
      text = sim.flags.accepted
        ? `${controlLabel("seal")}: откройте пломбу рядом с линией. Она действует на почтовые машины со знаком Ⅱ.`
        : touchDevice ? "Удерживайте ← / → для движения. Прыжок: перепрыгнуть разрыв." : `${keyLabel(settings.keys.left)} / ${keyLabel(settings.keys.right)}: движение. ${controlLabel("jump")}: перепрыгнуть разрыв.`;
    if (sub.textContent !== text) sub.textContent = text;
  }
}
ui.addEventListener("click", (event) => {
  const target = (event.target as HTMLElement).closest<HTMLButtonElement>(
    "button",
  );
  if (!target) return;
  if (target.dataset.control) return;
  void sound.unlock();
  sound.effect("click");
  if (target.dataset.bind) {
    binding = target.dataset.bind as keyof typeof DEFAULT_KEYS;
    renderUI();
    return;
  }
  switch (target.dataset.action) {
    case "splash":
      store.write("splash", true);
      setMode("menu");
      break;
    case "start":
      startDelivery();
      break;
    case "city":
      openIntro("menu");
      break;
    case "intro-next":
      if (introPage < introPages.length - 1) { introPage++; renderUI(); }
      else finishIntro();
      break;
    case "intro-back":
      if (introPage > 0) { introPage--; renderUI(); }
      break;
    case "intro-skip":
      finishIntro();
      break;
    case "journal":
      journalReturn = mode;
      setMode("journal");
      break;
    case "journal-back":
      setMode(journalReturn);
      break;
    case "accept":
      store.write("story", true);
      newGame();
      break;
    case "continue":
      continueGame();
      break;
    case "menu":
      if (mode === "pause" || mode === "game") persist();
      setMode("menu");
      break;
    case "settings":
      previous = mode;
      setMode("settings");
      break;
    case "about":
      setMode("about");
      break;
    case "back":
      binding = null;
      setMode(previous);
      break;
    case "pause":
      pause();
      break;
    case "resume":
      setMode(mode === "pause-ending" ? "ending" : "game");
      break;
    case "restart":
      previous = mode;
      setMode("restart");
      break;
    case "cancel-restart":
      setMode(previous);
      break;
    case "confirm-restart":
      sim.restart();
      setMode("game");
      break;
    case "help":
      setMode("help");
      break;
    case "skip":
      sim.skip();
      persist();
      setMode("game");
      break;
    case "receipt":
      setMode("receipt");
      break;
    case "reload":
      location.reload();
      break;
    case "reset-keys":
      settings.keys = { ...DEFAULT_KEYS };
      store.write("settings", settings);
      renderUI();
      break;
    case "fullscreen":
      if (document.fullscreenElement) void document.exitFullscreen();
      else
        void document.documentElement
          .requestFullscreen()
          .catch(() => toast("Полноэкранный режим недоступен."));
      break;
  }
});
ui.addEventListener("input", (event) => {
  const el = event.target as HTMLInputElement;
  const key = el.dataset.setting as keyof Settings;
  if (!key) return;
  if (el.type === "checkbox") (settings[key] as boolean) = el.checked;
  else {
    (settings[key] as number) = Number(el.value);
    const output = el.parentElement?.querySelector("output");
    if (output) output.textContent = `${Math.round(Number(el.value) * 100)}%`;
  }
  store.write("settings", settings);
  sound.apply();
});
window.addEventListener("keydown", (e) => {
  if (binding) {
    e.preventDefault();
    if (e.code === "Escape") {
      binding = null;
      renderUI();
      return;
    }
    if (
      !/^(Key[A-Z]|Digit[0-9]|Space|Arrow(Left|Right|Up|Down))$/.test(e.code) ||
      ["KeyR"].includes(e.code)
    ) {
      toast("Выберите букву, цифру, пробел или стрелку. R зарезервирована.");
      return;
    }
    const other = Object.entries(settings.keys).find(
      ([k, v]) => k !== binding && v === e.code,
    );
    if (other) {
      toast("Эта клавиша уже назначена другому действию.");
      return;
    }
    settings.keys[binding] = e.code;
    binding = null;
    store.write("settings", settings);
    renderUI();
    return;
  }
  if (mode === "splash") {
    setMode("menu");
    return;
  }
  if (mode === "intro" && !e.repeat && ["ArrowRight", "ArrowLeft"].includes(e.code)) {
    e.preventDefault();
    if (e.code === "ArrowLeft") { introPage = Math.max(0, introPage - 1); renderUI(); }
    else if (introPage < introPages.length - 1) { introPage++; renderUI(); }
    else finishIntro();
    return;
  }
  if (e.code === "Escape") {
    e.preventDefault();
    if (mode === "intro") { finishIntro(); return; }
    if (mode === "journal") { setMode(journalReturn); return; }
    if (mode === "game" || mode === "ending") pause();
    else if (mode === "pause") setMode("game");
    else if (mode === "pause-ending") setMode("ending");
    else if (mode === "settings") setMode(previous);
    else if (mode === "help") setMode("pause");
    else if (mode === "restart") setMode(previous);
    return;
  }
  if (mode !== "game") return;
  if (e.code === "KeyR" && !e.repeat) {
    previous = "game";
    setMode("restart");
    return;
  }
  if (e.code === "F2") {
    e.preventDefault();
    scene.debug = !scene.debug;
    return;
  }
  if (
    Object.values(settings.keys).includes(e.code) ||
    e.code.startsWith("Arrow")
  )
    e.preventDefault();
  if (!held.has(e.code) && !e.repeat) pressed.add(e.code);
  held.add(e.code);
});
window.addEventListener("keyup", (e) => held.delete(e.code));
window.addEventListener("blur", () => { touch.clear(); pause(); });
let portrait = innerHeight > innerWidth;
window.addEventListener("resize", () => {
  const nextPortrait = innerHeight > innerWidth;
  if (touchDevice && nextPortrait !== portrait) { touch.clear(); pause(); }
  portrait = nextPortrait;
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
window.addEventListener("pagehide", () => {
  touch.clear();
  pause();
});
export function frame(delta: number) {
  const dt = Math.min(delta / 1000, 0.1);
  statusTime -= dt;
  if (statusTime <= 0) toastEl.classList.remove("show");
  if (mode === "game") {
    accumulator += dt;
    while (accumulator >= STEP) {
      const tapped = touch.consume();
      const input: Input = {
        left: bound(held, "left", "ArrowLeft") || touch.held("left"),
        right: bound(held, "right", "ArrowRight") || touch.held("right"),
        down: bound(pressed, "down", "ArrowDown") || tapped.has("down"),
        jump: pressed.has(settings.keys.jump) || tapped.has("jump"),
        interact: pressed.has(settings.keys.interact) || tapped.has("interact"),
        seal: pressed.has(settings.keys.seal) || tapped.has("seal"),
      };
      pressed.clear();
      sim.step(input);

      accumulator -= STEP;
      const events = sim.events.splice(0);
      for (const event of events) {
        sound.effect(event);
        narrative.event(event, sim.roomIndex);
        if (event === "room" || event === "checkpoint") {
          scene.rebuild();
          persist();
        }
        if (event === "need-parcel")
          toast("Заберите посылку: она нужна адресату.");
        if (event === "unsafe")
          toast(
            "Здесь нет устойчивой площадки. Положите посылку на постоянный пол.",
          );
        if (event === "service-gate")
          toast(
            "Передайте посылку через почтовое окно. С ней через служебный проход не пройти.",
          );
        if (event === "send")
          toast(
            "Посылка на другой стороне. До левого подъёмника её поле не достаёт.",
          );
        if (event === "fall" && sim.deaths % 3 === 0)
          toast("Нужна подсказка? Пауза → Помощь. Можно пропустить препятствие.");
        if (event === "delivered") {
          persist(true);
          endingTime = 0;
          setMode("ending");
          scene.rebuild();
          sound.hush();
        }
      }
      if (mode !== "game") break;
      const line = narrative.update(statusTime > 0 ? 0 : STEP, sim.player.grounded && sim.roomTime > 1.5 && statusTime <= 0);
      if (line) { sound.speak(line.text); persist(); }
    }
    updateHUD();
    if (
      sim.player.grounded &&
      Math.abs(sim.player.vx) > 80 &&
      sim.elapsed - lastStep > 0.3
    ) {
      sound.effect("step");
      lastStep = sim.elapsed;
    }
    const machineLevel =
      sim.machines.filter((m) => !m.stopped).length /
      Math.max(1, sim.machines.length);
    sound.update("game", machineLevel);
  } else if (mode === "menu" || mode === "brief" || mode === "intro") sound.update("menu");
  else if (mode === "ending") {
    endingTime += dt;
    sound.update("final");
    if (endingTime > 5) {
      const el = document.querySelector("#ending-line");
      if (el) el.textContent = "«Ещё раз сначала?»";
    }
    if (endingTime > 10) setMode("receipt");
  } else sound.update("silent");
}
validateRooms();
renderUI();
const testCanvas = document.createElement("canvas");
const supported = !!testCanvas.getContext("2d");
export const scene = new GameScene();
if (!supported) {
  mode = "unsupported";
  renderUI();
} else
  new Phaser.Game({
    type: Phaser.CANVAS,
    parent: "game",
    width: 1280,
    height: touchDevice ? 640 : 720,
    backgroundColor: "#e8e4d8",
    render: { antialias: true, roundPixels: false },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [scene],
    banner: false,
    audio: { noAudio: true },
  });
// The game parent changes size independently of the viewport in the mobile
// layout. Refresh FIT after CSS and browser toolbars have settled.
new ResizeObserver(() => {
  if (scene.scale) {
    scene.scale.getParentBounds();
    scene.scale.refresh();
  }
}).observe(document.querySelector("#game")!);
// Read-only diagnostics for reproducible browser checks; no level-skip hooks in production.
if (import.meta.env.DEV)
  Object.defineProperty(window, "__spets", {
    get: () => ({ mode, state: sim.snapshot(), elapsed: sim.elapsed }),
  });
