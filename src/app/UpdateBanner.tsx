import { RefreshCw } from "lucide-react";
import { APP_VERSION } from "@/shared/config";
import { Button } from "@/shared/ui/button";
import { useAppUpdate } from "./appUpdate.ts";

/** Плашка «Вышло обновление» сверху экрана; «Обновить» включает новую версию и перезагружает страницу. */
export function UpdateBanner() {
  const { ready, version, updating, apply } = useAppUpdate();
  if (!ready) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div
        role="status"
        className="pointer-events-auto mx-auto flex max-w-md items-center gap-3 rounded-xl border bg-background p-3 shadow-lg"
      >
        <RefreshCw className="size-5 shrink-0 text-muted-foreground" />
        <p className="flex-1 text-sm">
          Вышло обновление Word Drill
          {version && version !== APP_VERSION && (
            <span className="block text-muted-foreground text-xs">
              {APP_VERSION} → {version}
            </span>
          )}
        </p>
        <Button size="sm" disabled={updating} onClick={apply}>
          {updating ? "Обновляю…" : "Обновить"}
        </Button>
      </div>
    </div>
  );
}
