export type TouchAction = "left" | "right" | "jump" | "down" | "interact" | "seal";
export const touchDevice = matchMedia("(any-pointer: coarse)").matches || navigator.maxTouchPoints > 0;
document.body.dataset.touch = String(touchDevice);

const control = (action: TouchAction, icon: string, label: string) =>
  `<button data-control="${action}" aria-label="${label}"><b aria-hidden="true">${icon}</b><span>${label}</span></button>`;
export const touchControls = () => `<div class="touch-controls" aria-label="Управление курьером"><div class="touch-move">${control("left", "←", "Влево")}${control("right", "→", "Вправо")}</div><div class="touch-actions">${control("down", "↓", "Спуск")}${control("jump", "↑", "Прыжок")}${control("interact", "▣", "Посылка")}${control("seal", "Ⅱ", "Пломба")}</div><p class="rotate-hint">Поверните телефон — маршрут будет крупнее.</p></div>`;

export class TouchInput {
  private pointers = new Map<number, { action: TouchAction; button: HTMLButtonElement }>();
  private pressed = new Set<TouchAction>();

  constructor(root: HTMLElement, active: () => boolean, unlock: () => void) {
    root.addEventListener("pointerdown", event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-control]");
      if (!button || !active() || (event.pointerType === "mouse" && event.button !== 0)) return;
      event.preventDefault();
      unlock();
      const action = button.dataset.control as TouchAction;
      if (!this.held(action)) this.pressed.add(action);
      this.pointers.set(event.pointerId, { action, button });
      button.classList.add("held");
      button.setPointerCapture(event.pointerId);
    });
    const release = (event: PointerEvent) => {
      const pointer = this.pointers.get(event.pointerId);
      if (!pointer) return;
      this.pointers.delete(event.pointerId);
      if (!this.held(pointer.action)) {
        pointer.button.classList.remove("held");
        if (event.type !== "pointerup") this.pressed.delete(pointer.action);
      }
    };
    root.addEventListener("pointerup", release);
    root.addEventListener("pointercancel", release);
    root.addEventListener("lostpointercapture", release);
    root.addEventListener("contextmenu", event => {
      if ((event.target as HTMLElement).closest("[data-control]")) event.preventDefault();
    });
  }

  held(action: TouchAction) {
    return [...this.pointers.values()].some(pointer => pointer.action === action);
  }

  consume() {
    const actions = new Set(this.pressed);
    this.pressed.clear();
    return actions;
  }

  clear() {
    const pointers = [...this.pointers];
    this.pointers.clear();
    this.pressed.clear();
    for (const [id, { button }] of pointers) {
      button.classList.remove("held");
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    }
  }
}
