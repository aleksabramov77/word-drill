import { Button } from "@/shared/ui/button";
import { FONT_STEPS, fontScale, useFontSize } from "../model/store.ts";

/** Две кнопки: шрифт меньше / больше — для всего приложения. */
export function FontSizeButtons() {
  const { step, bigger, smaller } = useFontSize();
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        aria-label="Шрифт меньше"
        disabled={step <= 0}
        onClick={smaller}
      >
        <span className="text-sm">A−</span>
      </Button>
      <span className="w-12 text-center text-muted-foreground text-sm tabular-nums">
        {Math.round(fontScale(step) * 100)}%
      </span>
      <Button
        variant="outline"
        size="sm"
        aria-label="Шрифт больше"
        disabled={step >= FONT_STEPS.length - 1}
        onClick={bigger}
      >
        <span className="text-lg">A+</span>
      </Button>
    </div>
  );
}
