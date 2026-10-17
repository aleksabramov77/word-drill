// Готовая команда iOS «Команды»: снимок экрана → распознать текст → во «Входящие» Word Drill.
// Ключа в файле нет: при установке iPhone спрашивает его (вопрос импорта), приложение кладёт ключ
// в буфер обмена кнопкой «Установить команду». Файл подписывается на Mac (`shortcuts sign`,
// режим «anyone») — без подписи iPhone не импортирует команду из файла.
// Запуск (только macOS): pnpm shortcut:build [https://адрес-сайта] → public/word-drill.shortcut
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildShortcutPlist } from "./lib/shortcut.ts";

const site = process.argv[2] ?? "https://words.13.114.11.53.sslip.io";
const output = "public/word-drill.shortcut";

const dir = mkdtempSync(join(tmpdir(), "word-drill-shortcut-"));
const unsigned = join(dir, "Word Drill.shortcut");
writeFileSync(unsigned, buildShortcutPlist(`${site}/api/inbox`));
execFileSync("plutil", ["-convert", "binary1", unsigned]);
execFileSync("shortcuts", [
  "sign",
  "--mode",
  "anyone",
  "--input",
  unsigned,
  "--output",
  output,
]);
console.log(`Команда для ${site} → ${output}`);
