const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * «сейчас», «через 5 минут», «через 3 часа», «через 12 дней».
 * «Сейчас» — только меньше полуминуты: срок «через минуту» доходит до экрана чуть позже и не должен стать «сейчас».
 */
export function untilText(due: Date, now = new Date()): string {
  const ms = due.getTime() - now.getTime();
  if (ms < MINUTE / 2) return "сейчас";
  if (ms < HOUR) {
    const n = Math.max(1, Math.round(ms / MINUTE));
    return `через ${n} ${plural(n, "минуту", "минуты", "минут")}`;
  }
  if (ms < DAY) {
    const n = Math.round(ms / HOUR);
    return `через ${n} ${plural(n, "час", "часа", "часов")}`;
  }
  const n = Math.round(ms / DAY);
  return `через ${n} ${plural(n, "день", "дня", "дней")}`;
}

export { plural };
