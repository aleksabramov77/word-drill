import { Badge } from "@/shared/ui/badge";
import type { WordStatus } from "../model/types.ts";

const LABELS: Record<WordStatus, string> = {
  new: "новое",
  learning: "учится",
  errors: "с ошибками",
  learned: "выучено",
};

const STYLES: Record<WordStatus, string> = {
  // Контрастные пары: тёмный текст на светлом фоне, в тёмной теме — белый на насыщенном.
  new: "bg-zinc-200 text-zinc-900 dark:bg-zinc-700 dark:text-white",
  learning: "bg-sky-200 text-sky-950 dark:bg-sky-800 dark:text-white",
  errors: "bg-amber-200 text-amber-950 dark:bg-amber-700 dark:text-white",
  learned:
    "bg-emerald-200 text-emerald-950 dark:bg-emerald-800 dark:text-white",
};

export function WordStatusBadge({ status }: { status: WordStatus }) {
  return (
    <Badge variant="secondary" className={STYLES[status]}>
      {LABELS[status]}
    </Badge>
  );
}
