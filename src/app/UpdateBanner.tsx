import { RefreshCw } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { useAppUpdate } from "./appUpdate.ts";

/** Плашка «Вышло обновление» сверху экрана; «Обновить» включает новую версию и перезагружает страницу. */
export function UpdateBanner() {
  const { ready, updating, apply } = useAppUpdate();
  if (!ready) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div
        role="status"
        className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-background p-3 shadow-lg"
      >
        <RefreshCw className="size-5 shrink-0 text-muted-foreground" />
        <p className="flex-1 text-sm">Вышло обновление Word Drill</p>
        <Button size="sm" disabled={updating} onClick={apply}>
          {updating ? "Обновляю…" : "Обновить"}
        </Button>
      </div>
    </div>
  );
}
