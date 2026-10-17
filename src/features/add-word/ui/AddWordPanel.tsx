import { useMemo, useState } from "react";
import {
  useDictionarySearch,
  useUnits,
  useUnitWords,
} from "@/entities/dictionary";
import { useWords } from "@/entities/word";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { DictionaryWordRow } from "./DictionaryWordRow.tsx";
import { ManualWordForm } from "./ManualWordForm.tsx";

/** Какие английские слова уже в списке — чтобы показать «В списке» вместо «Добавить». */
function useAddedAnswers(): Set<string> {
  const { data } = useWords();
  return useMemo(
    () =>
      new Set(
        (data ?? []).flatMap((w) => w.answers.map((a) => a.toLowerCase())),
      ),
    [data],
  );
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const { data: hits, isFetching } = useDictionarySearch(query);
  const added = useAddedAnswers();
  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        placeholder="Слово по-русски или по-английски"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        aria-label="Поиск в словаре"
      />
      {query.trim() !== "" && hits?.length === 0 && !isFetching && (
        <p className="text-muted-foreground text-sm">
          В словаре курса не нашлось — добавь вручную.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {hits?.map((hit) => (
          <DictionaryWordRow
            key={`${hit.word.en}:${query}`}
            word={hit.word}
            matched={hit.matched === hit.word.en ? undefined : hit.matched}
            added={added.has(hit.word.en.toLowerCase())}
          />
        ))}
      </ul>
    </div>
  );
}

function UnitTab() {
  const { data: units } = useUnits();
  const [unit, setUnit] = useState<number | null>(null);
  const { data } = useUnitWords(unit);
  const added = useAddedAnswers();
  return (
    <div className="flex flex-col gap-3">
      <select
        className="h-9 rounded-md border bg-transparent px-3 text-sm"
        value={unit ?? ""}
        onChange={(e) =>
          setUnit(e.target.value ? Number(e.target.value) : null)
        }
        aria-label="Юнит курса"
      >
        <option value="">Выбери юнит курса…</option>
        {units?.map((u) => (
          <option key={u.n} value={u.n}>
            {u.n}. {u.title} — {u.goal}
          </option>
        ))}
      </select>
      <ul className="flex flex-col gap-2">
        {data?.words.map((word) => (
          <DictionaryWordRow
            key={`${unit}:${word.en}`}
            word={word}
            added={added.has(word.en.toLowerCase())}
          />
        ))}
      </ul>
    </div>
  );
}

export function AddWordPanel() {
  return (
    <Tabs defaultValue="search">
      <TabsList className="w-full">
        <TabsTrigger value="search">Поиск</TabsTrigger>
        <TabsTrigger value="unit">По юниту</TabsTrigger>
        <TabsTrigger value="manual">Вручную</TabsTrigger>
      </TabsList>
      <TabsContent value="search" className="pt-2">
        <SearchTab />
      </TabsContent>
      <TabsContent value="unit" className="pt-2">
        <UnitTab />
      </TabsContent>
      <TabsContent value="manual" className="pt-2">
        <ManualWordForm />
      </TabsContent>
    </Tabs>
  );
}
