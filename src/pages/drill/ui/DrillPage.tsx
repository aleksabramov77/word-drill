import { Link } from "react-router";
import { AnswerCard, useDrillQueue } from "@/features/answer-card";
import { untilText } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";

export function DrillPage() {
  const { data: queue, isLoading, isError, refetch } = useDrillQueue();

  if (isLoading) return <p className="text-muted-foreground">Загрузка…</p>;
  if (isError || !queue) {
    return (
      <div className="flex flex-col gap-3">
        <p>Не получилось загрузить слова.</p>
        <Button onClick={() => refetch()}>Ещё раз</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground text-sm">
        Пора повторить: {queue.dueCount} · Новых: {queue.newCount}
      </p>
      {queue.card ? (
        <AnswerCard card={queue.card} onNext={() => refetch()} />
      ) : (
        <div className="flex flex-col items-start gap-3 rounded-xl border p-6">
          <p className="font-medium text-lg">Сейчас повторять нечего 🎉</p>
          <p className="text-muted-foreground">
            {queue.nextDue
              ? `Следующее слово — ${untilText(new Date(queue.nextDue))}.`
              : "Добавь слова, которые не запоминаются."}
          </p>
          <Button asChild variant="outline">
            <Link to="/words">К словам</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
