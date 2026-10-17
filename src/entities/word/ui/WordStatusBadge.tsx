import { Badge } from "@/shared/ui/badge";
import type { WordStatus } from "../model/types.ts";

const LABELS: Record<WordStatus, string> = {
  new: "новое",
  learning: "учится",
  errors: "с ошибками",
  learned: "выучено",
};

const STYLES: Record<WordStatus, string> = {
  new: "bg-secondary text-secondary-foreground",
  learning: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  errors: "bg-warning/20 text-amber-700 dark:text-amber-300",
  learned: "bg-success/15 text-emerald-700 dark:text-emerald-300",
};

export function WordStatusBadge({ status }: { status: WordStatus }) {
  return (
    <Badge variant="secondary" className={STYLES[status]}>
      {LABELS[status]}
    </Badge>
  );
}
