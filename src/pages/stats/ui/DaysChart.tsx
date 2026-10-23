import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import type { DayStats } from "../api/statsApi.ts";

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS = [
  "янв",
  "фев",
  "мар",
  "апр",
  "мая",
  "июн",
  "июл",
  "авг",
  "сен",
  "окт",
  "ноя",
  "дек",
];

/** «пт, 23 окт» из YYYY-MM-DD. */
export function dayLabel(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAYS[date.getUTCDay()]}, ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
}

function dayText(d: DayStats): string {
  if (d.total === 0) return `${dayLabel(d.day)}: не занимался`;
  return `${dayLabel(d.day)}: ответов ${d.total}, сам вспомнил ${d.clean}, с подсказкой ${d.total - d.clean}`;
}

/**
 * Столбики по дням: снизу — «вспомнил сам», сверху — «с подсказкой».
 * Касание столбика показывает цифры дня под графиком.
 */
export function DaysChart({ days }: { days: DayStats[] }) {
  const [picked, setPicked] = useState(days.length - 1);
  const max = Math.max(1, ...days.map((d) => d.total));
  const current = days[picked] ?? days.at(-1);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        <span className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-sm bg-success" />
          вспомнил сам
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3.5 rounded-sm bg-foreground/30" />с подсказкой
        </span>
      </div>
      <div className="flex h-40 items-end gap-0.5 border-foreground/20 border-b">
        {days.map((d, i) => {
          const hinted = d.total - d.clean;
          return (
            <button
              key={d.day}
              type="button"
              aria-label={dayText(d)}
              aria-pressed={i === picked}
              onClick={() => setPicked(i)}
              onMouseEnter={() => setPicked(i)}
              className={cn(
                "flex h-full min-w-0 flex-1 flex-col justify-end gap-0.5 rounded-t-md px-0.5",
                i === picked && "bg-muted",
              )}
            >
              {hinted > 0 && (
                <span
                  className="w-full rounded-t-[4px] bg-foreground/30"
                  style={{ height: `${(hinted / max) * 100}%` }}
                />
              )}
              {d.clean > 0 && (
                <span
                  className={cn(
                    "w-full bg-success",
                    hinted === 0 && "rounded-t-[4px]",
                  )}
                  style={{ height: `${(d.clean / max) * 100}%` }}
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="-mt-2 flex gap-0.5 text-muted-foreground text-xs">
        {days.map((d, i) => (
          <span
            key={d.day}
            className={cn(
              "min-w-0 flex-1 text-center",
              i === picked && "font-semibold text-foreground",
            )}
          >
            {/* Через день, считая от сегодня: при крупном шрифте числа не слипаются. */}
            {(days.length - 1 - i) % 2 === 0 || i === picked
              ? Number(d.day.slice(8))
              : ""}
          </span>
        ))}
      </div>
      {current && (
        <p className="text-base" data-testid="day-details">
          {dayText(current)}
        </p>
      )}
    </div>
  );
}
