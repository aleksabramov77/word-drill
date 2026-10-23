import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Ступени размера шрифта: множитель к 16px. Весь интерфейс в rem — растёт вместе с ним. */
export const FONT_STEPS = [0.9, 1, 1.1, 1.2, 1.35, 1.5, 1.7] as const;
const DEFAULT_STEP = 1;

interface FontSizeState {
  step: number;
  bigger: () => void;
  smaller: () => void;
}

const clamp = (step: number) =>
  Math.min(FONT_STEPS.length - 1, Math.max(0, step));

export const useFontSize = create<FontSizeState>()(
  persist(
    (set) => ({
      step: DEFAULT_STEP,
      bigger: () => set((s) => ({ step: clamp(s.step + 1) })),
      smaller: () => set((s) => ({ step: clamp(s.step - 1) })),
    }),
    // localStorage: размер свой на каждом устройстве и переживает перезагрузку.
    { name: "font-size", storage: createJSONStorage(() => localStorage) },
  ),
);

export function fontScale(step: number): number {
  return FONT_STEPS[clamp(step)] ?? 1;
}

/** Применить сохранённый размер к странице и следить за изменениями. */
export function applyFontSize() {
  const apply = (step: number) => {
    document.documentElement.style.fontSize = `${fontScale(step) * 100}%`;
  };
  apply(useFontSize.getState().step);
  useFontSize.subscribe((s) => apply(s.step));
}
