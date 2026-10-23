import type { WordStatus } from "../../src/shared/lib/srs/index.ts";
import type { WordView } from "./types.ts";

const STATUS: Record<WordStatus, string> = {
  new: "новое",
  learning: "учится",
  errors: "с ошибками",
  learned: "выучено",
};

const HEADER = [
  "По-русски",
  "По-английски",
  "Статус",
  "Знание, %",
  "Следующий повтор",
  "en → ru: статус",
  "en → ru: знание, %",
  "en → ru: повтор",
  "Добавлено",
];

/** «;» — разделитель русского Excel; Numbers и Google Таблицы его тоже понимают. */
const SEP = ";";

function cell(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** «2026-10-23 14:05» в часовом поясе пользователя. */
function localStamp(iso: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
}

const percent = (knowledge: number) => String(Math.round(knowledge * 100));

/** Список слов в CSV; BOM в начале — чтобы Excel узнал UTF-8 и не исказил кириллицу. */
export function wordsCsv(list: readonly WordView[], timeZone: string): string {
  const rows = list.map((w) => [
    w.prompt,
    w.answers.join(", "),
    STATUS[w.status],
    w.status === "new" ? "" : percent(w.knowledge),
    w.status === "new" ? "" : localStamp(w.due, timeZone),
    w.reverse ? STATUS[w.reverse.status] : "",
    w.reverse && w.reverse.status !== "new" ? percent(w.reverse.knowledge) : "",
    w.reverse && w.reverse.status !== "new"
      ? localStamp(w.reverse.due, timeZone)
      : "",
    localStamp(w.createdAt, timeZone),
  ]);
  return `﻿${[HEADER, ...rows]
    .map((row) => row.map(cell).join(SEP))
    .join("\r\n")}\r\n`;
}
