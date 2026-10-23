import { Flame, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useDeleteWord,
  useWords,
  type Word,
  WordStatusBadge,
} from "@/entities/word";
import { untilText } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";

const CONFIRM_MS = 3000;

function DeleteButton({ word }: { word: Word }) {
  const remove = useDeleteWord();
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), CONFIRM_MS);
    return () => clearTimeout(timer);
  }, [armed]);
  return (
    <Button
      size="sm"
      variant={armed ? "destructive" : "ghost"}
      disabled={remove.isPending}
      onClick={() => (armed ? remove.mutate(word.id) : setArmed(true))}
      aria-label={
        armed ? `Точно удалить ${word.prompt}` : `Удалить ${word.prompt}`
      }
    >
      {armed ? "Удалить?" : <Trash2 />}
    </Button>
  );
}

function WordRow({ word }: { word: Word }) {
  const due = new Date(word.due);
  return (
    <li className="flex items-center justify-between gap-2 rounded-lg border p-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="break-words">
          <span className="font-medium">{word.prompt}</span>
          <span className="text-muted-foreground">
            {" "}
            — {word.answers.join(", ")}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
          <WordStatusBadge status={word.status} />
          {word.hot && (
            <Flame
              className="size-5 text-orange-500"
              aria-label="горячий круг"
            />
          )}
          {word.status !== "new" && (
            <span>
              знание {Math.round(word.knowledge * 100)}% · повтор{" "}
              {untilText(due)}
            </span>
          )}
        </span>
      </div>
      <DeleteButton word={word} />
    </li>
  );
}

export function WordList() {
  const { data: words, isLoading } = useWords();
  if (isLoading)
    return <p className="text-muted-foreground text-sm">Загрузка…</p>;
  if (!words?.length) {
    return (
      <p className="text-muted-foreground text-sm">
        Пока пусто. Найди слово в словаре курса или добавь вручную.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {words.map((word) => (
        <WordRow key={word.id} word={word} />
      ))}
    </ul>
  );
}
