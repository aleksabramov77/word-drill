import { existsSync, readFileSync } from "node:fs";
import { type Dictionary, dictionarySchema } from "./schema.ts";

export const DEFAULT_DICTIONARY_PATH = "data/dictionary.json";

const EMPTY: Dictionary = {
  source: "none",
  importedAt: "",
  units: [],
  words: [],
};

/** Читает словарь; если файла нет (не запускали `pnpm dict:import`) — пустой словарь, приложение работает без него. */
export function loadDictionary(path = DEFAULT_DICTIONARY_PATH): Dictionary {
  if (!existsSync(path)) {
    console.warn(
      `[word-drill] нет словаря ${path} — запустите pnpm dict:import`,
    );
    return EMPTY;
  }
  return dictionarySchema.parse(JSON.parse(readFileSync(path, "utf8")));
}
