export { DEFAULT_DICTIONARY_PATH, loadDictionary } from "./load.ts";
export {
  type Dictionary,
  type DictionaryUnit,
  type DictionaryWord,
  dictionarySchema,
} from "./schema.ts";
export { type SearchHit, searchDictionary, unitWords } from "./search.ts";
export { otherForms, synonymsOf } from "./translations.ts";
