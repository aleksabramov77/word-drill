// Импорт русско-английского словаря из Викисловаря (выгрузка kaikki.org) → data/wiktionary.tsv.gz.
//   pnpm wikt:import --from <файл .jsonl.gz>   взять скачанную выгрузку
//   (скачать: https://kaikki.org/dictionary/Russian/kaikki.org-dictionary-Russian.jsonl.gz, ~90 МБ)
// Лицензия Викисловаря — CC BY-SA: источник указан в приложении рядом с найденными словами.
import { createReadStream, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { createGunzip, gzipSync } from "node:zlib";
import {
  DEFAULT_WIKTIONARY_PATH,
  formatLine,
  type WiktEntry,
} from "../server/wiktionary/index.ts";
import {
  extractEntry,
  type KaikkiEntry,
  mergeEntries,
} from "./lib/wiktionary.ts";

const SOURCE = "https://kaikki.org/dictionary/Russian/";

async function main() {
  const { values } = parseArgs({
    options: {
      from: { type: "string" },
      out: { type: "string", default: DEFAULT_WIKTIONARY_PATH },
    },
  });
  if (!values.from) {
    throw new Error(
      "укажите --from <kaikki.org-dictionary-Russian.jsonl.gz> (скачать — см. начало файла)",
    );
  }

  const lines = createInterface({
    input: createReadStream(values.from).pipe(createGunzip()),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  const entries: WiktEntry[] = [];
  let read = 0;
  for await (const line of lines) {
    read++;
    const entry = extractEntry(JSON.parse(line) as KaikkiEntry);
    if (entry) entries.push(entry);
  }
  const merged = mergeEntries(entries);
  if (merged.length < 10_000) {
    throw new Error(
      `подозрительно мало слов (${merged.length}) — формат выгрузки изменился?`,
    );
  }

  const text = [
    `# Wiktionary (CC BY-SA) via ${SOURCE}, imported ${new Date().toISOString().slice(0, 10)}`,
    ...merged.map(formatLine),
  ].join("\n");
  const gz = gzipSync(text, { level: 9 });
  mkdirSync(dirname(values.out), { recursive: true });
  writeFileSync(values.out, gz);
  console.log(
    `[wikt-import] ${values.out}: ${merged.length} слов из ${read} статей, ${(gz.length / 1e6).toFixed(1)} МБ`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
