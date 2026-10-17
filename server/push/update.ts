import { and, eq, isNull, ne, or } from "drizzle-orm";
import { compareVersions } from "../../src/shared/lib/semver/index.ts";
import type { Db } from "../db/client.ts";
import { pushSubscriptions, users } from "../db/schema.ts";
import { localTime } from "./decide.ts";
import type { PushPayload, PushSender } from "./sender.ts";
import { deliver, getSettings } from "./service.ts";

// «Word Drill обновился»: приложение с экрана «Домой» живёт днями и само новую версию не ищет.
// Уведомление будит service worker — он скачивает новую версию (src/app/sw.ts → push), а нажатие открывает
// уже обновлённое приложение. Одно уведомление на версию, только в часы пользователя и только тем,
// чьё приложение ещё старое (версию клиент присылает в заголовке X-App-Version).

const VERSION = /^\d+\.\d+\.\d+$/;

/** Запомнить версию приложения пользователя (заголовок X-App-Version). */
export function rememberAppVersion(
  db: Db,
  userId: string,
  version: string | undefined,
): void {
  if (!version || !VERSION.test(version)) return;
  db.update(users)
    .set({ appVersion: version })
    .where(
      and(
        eq(users.id, userId),
        or(isNull(users.appVersion), ne(users.appVersion, version)),
      ),
    )
    .run();
}

export function updatePayload(version: string): PushPayload {
  return {
    title: "Word Drill обновился",
    body: `Версия ${version} — нажми, чтобы открыть новую`,
    url: "/",
    tag: "update",
  };
}

/** Кому пора сообщить об обновлении до этой версии. */
export function needsUpdateNotice(
  user: { appVersion: string | null; updateNotifiedVersion: string | null },
  version: string,
): boolean {
  if (user.updateNotifiedVersion === version) return false;
  if (!user.appVersion) return true;
  return compareVersions(version, user.appVersion) > 0;
}

/** Один проход: всем подписанным на уведомления, кому пора, — «Word Drill обновился». */
export async function announceUpdate(
  db: Db,
  sender: PushSender,
  version: string,
  now: Date,
): Promise<number> {
  const userIds = db
    .selectDistinct({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .all()
    .map((row) => row.userId);
  let sent = 0;
  for (const userId of userIds) {
    const user = db
      .select({
        appVersion: users.appVersion,
        updateNotifiedVersion: users.updateNotifiedVersion,
      })
      .from(users)
      .where(eq(users.id, userId))
      .get();
    if (!user || !needsUpdateNotice(user, version)) continue;
    const settings = getSettings(db, userId);
    const { hour } = localTime(now, settings.timeZone);
    if (hour < settings.windowStart || hour >= settings.windowEnd) continue;
    // Отмечаем до отправки: не доставилось — не повторяем, обновление придёт и без уведомления.
    db.update(users)
      .set({ updateNotifiedVersion: version })
      .where(eq(users.id, userId))
      .run();
    if ((await deliver(db, sender, userId, updatePayload(version))) > 0) sent++;
  }
  return sent;
}
