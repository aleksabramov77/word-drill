import { Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useDeleteWord, type Word, WordStatusBadge } from "@/entities/word";
import { Button } from "@/shared/ui/button";

/** Карточка уже добавленного слова: что в списке и кнопка «Убрать из списка». */
export function ExistingWordNotice({
  word,
  title,
  onRemoved,
  children,
}: {
  word: Word;
  title: string;
  onRemoved: () => void;
  children?: React.ReactNode;
}) {
  const remove = useDeleteWord();
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-primary/30 bg-secondary p-3 text-sm"
      data-testid="existing-word"
    >
      <p className="font-medium">{title}</p>
      <p>
        <span className="font-medium">{word.prompt}</span>
        <span className="text-muted-foreground">
          {" "}
          — {word.answers.join(", ")}
        </span>
      </p>
      <p className="flex items-center gap-2 text-muted-foreground text-xs">
        <WordStatusBadge status={word.status} />
        {word.status !== "new" && (
          <>знание {Math.round(word.knowledge * 100)}%</>
        )}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={remove.isPending}
          onClick={() =>
            remove.mutate(word.id, {
              onSuccess: () => {
                toast.success(`Убрано: ${word.prompt}`);
                onRemoved();
              },
            })
          }
        >
          <Undo2 />
          Убрать из списка
        </Button>
        {children}
      </div>
    </div>
  );
}
