// Клавиатура телефона не закрывается между шагами и карточками.
// iOS открывает клавиатуру только на фокус по касанию, а закрывает, как только фокус уходит из поля.
// Поэтому, когда поле ввода исчезает, фокус переходит в невидимое поле-держатель,
// а следующее поле забирает фокус у него — клавиатура остаётся открытой.

let keeper: HTMLInputElement | null = null;
let onEnter: (() => void) | null = null;

function keeperInput(): HTMLInputElement {
  if (keeper?.isConnected) return keeper;
  const el = document.createElement("input");
  el.setAttribute("aria-hidden", "true");
  el.tabIndex = -1;
  el.autocomplete = "off";
  el.enterKeyHint = "next";
  // 16px — иначе iPhone приближает страницу при фокусе.
  el.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;border:0;padding:0;font-size:16px;pointer-events:none";
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter?.();
    }
  });
  el.addEventListener("input", () => {
    el.value = "";
  });
  document.body.append(el);
  keeper = el;
  return el;
}

/** Поле внутри container вот-вот исчезнет: если фокус в нём — держим клавиатуру. */
export function holdKeyboard(container: HTMLElement | null) {
  const active = document.activeElement;
  if (!container || !(active instanceof HTMLInputElement)) return;
  if (!container.contains(active)) return;
  keeperInput().focus({ preventScroll: true });
}

/** Клавиатура сейчас открыта держателем (ответ принят, полей нет). */
export function keyboardHeld(): boolean {
  return keeper !== null && document.activeElement === keeper;
}

/** Enter на клавиатуре, пока полей нет (например, «Дальше»). */
export function onHeldEnter(handler: (() => void) | null) {
  onEnter = handler;
}

/** Карточек больше нет — отпускаем клавиатуру. */
export function releaseKeyboard() {
  if (keyboardHeld()) keeper?.blur();
}
