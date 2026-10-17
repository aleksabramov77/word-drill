// Импорт словаря курса Duolingo «английский для русскоязычных» с duome.eu → data/dictionary.json.
//   pnpm dict:import                  скачать обе страницы
//   pnpm dict:import --from <папка>   взять сохранённые ru-en.html и ru-en-skills.html
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import {
  DEFAULT_DICTIONARY_PATH,
  dictionarySchema,
} from "../server/dictionary/index.ts";
import {
  buildDictionary,
  parseAlphabetical,
  parseSkills,
} from "./lib/duome.ts";

const BASE = "https://duome.eu/vocabulary/ru/en";

async function download(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": "word-drill" } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.text();
}

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: "string" },
      out: { type: "string", default: DEFAULT_DICTIONARY_PATH },
    },
  });
  const [alphabeticalHtml, skillsHtml] = values.from
    ? [
        readFileSync(join(values.from, "ru-en.html"), "utf8"),
        readFileSync(join(values.from, "ru-en-skills.html"), "utf8"),
      ]
    : await Promise.all([download(BASE), download(`${BASE}/skills`)]);

  const alphabetical = parseAlphabetical(alphabeticalHtml);
  const skills = parseSkills(skillsHtml);
  const dictionary = dictionarySchema.parse(
    buildDictionary(alphabetical, skills, BASE, new Date()),
  );
  if (dictionary.words.length < 1000 || dictionary.units.length < 10) {
    throw new Error(
      `подозрительно мало данных (${dictionary.words.length} слов, ${dictionary.units.length} юнитов) — разметка duome изменилась?`,
    );
  }

  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out, `${JSON.stringify(dictionary)}\n`);
  const inUnits = dictionary.words.filter((w) => w.units.length > 0).length;
  const missing = dictionary.words.filter((w) => w.missing).length;
  console.log(
    `[dict-import] ${values.out}: ${dictionary.words.length} слов (в юнитах ${inUnits}, нет в курсе ${missing}), ${dictionary.units.length} юнитов`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
