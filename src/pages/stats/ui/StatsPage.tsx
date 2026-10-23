import type { ReactNode } from "react";
import { type WordStatus, WordStatusBadge } from "@/entities/word";
import { plural } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { useStats } from "../api/statsApi.ts";
import { DaysChart } from "./DaysChart.tsx";

function Tile({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border p-3">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="font-semibold text-3xl">{value}</span>
      {note && <span className="text-muted-foreground text-sm">{note}</span>}
    </div>
  );
}

const STATUSES: WordStatus[] = ["new", "learning", "errors", "learned"];

export function StatsPage() {
  const { data: stats, isLoading, isError, refetch } = useStats();
  if (isLoading) return <p className="text-muted-foreground">Загрузка…</p>;
  if (isError || !stats) {
    return (
      <div className="flex flex-col gap-3">
        <p>Не получилось загрузить статистику.</p>
        <Button onClick={() => refetch()}>Ещё раз</Button>
      </div>
    );
  }
  const share = stats.allTime.total
    ? `${Math.round((stats.allTime.clean / stats.allTime.total) * 100)}%`
    : "—";
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-2xl">Статистика</h1>

      <div className="grid grid-cols-2 gap-2">
        <Tile
          label="Сегодня ответов"
          value={stats.today.total}
          note={`сам вспомнил ${stats.today.clean}`}
        />
        <Tile
          label="Серия"
          value={`${stats.streak} ${plural(stats.streak, "день", "дня", "дней")}`}
          note="подряд с ответами"
        />
        <Tile
          label="Вспомнил сам"
          value={share}
          note={`из ${stats.allTime.total} ${plural(stats.allTime.total, "ответа", "ответов", "ответов")}`}
        />
        <Tile
          label="Слов"
          value={stats.words.total}
          note={`en → ru открыто: ${stats.words.reverse}`}
        />
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-lg">Слова по статусам</h2>
        <ul className="flex flex-wrap gap-x-4 gap-y-2">
          {STATUSES.map((status) => (
            <li key={status} className="flex items-center gap-2 text-lg">
              <WordStatusBadge status={status} />
              <span className="font-semibold">{stats.words[status]}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-lg">Последние 2 недели</h2>
        <DaysChart days={stats.days} />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-lg">Труднее всего</h2>
        {stats.hardest.length === 0 ? (
          <p className="text-muted-foreground">
            Пока нет слов, которые не вспомнились.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {stats.hardest.map((word) => (
              <li
                key={word.wordId}
                className="flex flex-wrap items-baseline justify-between gap-x-3 rounded-lg border p-3"
              >
                <span className="break-words text-lg">
                  <span className="font-medium">{word.prompt}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    — {word.answer}
                  </span>
                </span>
                <span className="text-muted-foreground text-sm">
                  не вспомнил {word.misses}{" "}
                  {plural(word.misses, "раз", "раза", "раз")}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
