// CI для pull request: версия в package.json должна быть выше, чем в ветке, куда PR вливается.
// Так у каждой выкатки свой номер. Запуск: tsx scripts/check-version.ts origin/main
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { hasRelease } from "../src/shared/lib/changelog/index.ts";
import { compareVersions } from "../src/shared/lib/semver/index.ts";

const baseRef = process.argv[2];
if (!baseRef) {
  console.error(
    "Укажи ветку для сравнения: tsx scripts/check-version.ts origin/main",
  );
  process.exit(2);
}

const readVersion = (json: string): string =>
  (JSON.parse(json) as { version: string }).version;

const current = readVersion(readFileSync("package.json", "utf8"));
const base = readVersion(
  execFileSync("git", ["show", `${baseRef}:package.json`], {
    encoding: "utf8",
  }),
);

if (compareVersions(current, base) <= 0) {
  console.error(
    `Версия ${current} не выше, чем в ${baseRef} (${base}). Подними её в package.json: ` +
      "исправление — третья цифра, новая возможность — вторая, крупная переделка — первая.",
  );
  process.exit(1);
}
if (!hasRelease(readFileSync("CHANGELOG.md", "utf8"), current)) {
  console.error(
    `В CHANGELOG.md нет записи «## ${current} — дата» с пунктами: что добавлено, исправлено, изменилось.`,
  );
  process.exit(1);
}
console.log(`Версия ${base} → ${current}`);
