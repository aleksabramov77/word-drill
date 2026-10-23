import { type RefObject, useEffect } from "react";

/**
 * Липкий заголовок у верха видимой части экрана. На iPhone при открытой клавиатуре видимая часть
 * сдвигается внутри страницы, и обычный `top: 0` уезжает под неё — сдвигаем на этот отступ.
 */
export function useStickToVisibleTop(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    const el = ref.current;
    if (!viewport || !el) return;
    const update = () => {
      const offset = Math.max(0, Math.round(viewport.offsetTop));
      el.style.top = offset
        ? `calc(${offset}px + env(safe-area-inset-top))`
        : "";
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [ref]);
}
