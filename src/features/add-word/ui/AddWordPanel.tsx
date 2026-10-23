import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  useDictionarySearch,
  useUnits,
  useUnitWords,
} from "@/entities/dictionary";
import { useWords, type Word } from "@/entities/word";
import { normalize } from "@/shared/lib/answer-check";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { wordsByAnswer } from "../model/existing.ts";
import { DictionaryWordRow } from "./DictionaryWordRow.tsx";
import { InboxTab } from "./InboxTab.tsx";
import { ManualWordForm } from "./ManualWordForm.tsx";

/** Слово словаря → уже добавленное слово списка (по английскому ответу) — для «Добавлено» и «Убрать». */
function useAddedWords(): (en: string) => Word | undefined {
  const { data } = useWords();
  const map = useMemo(() => wordsByAnswer(data ?? []), [data]);
  return (en) => map.get(normalize(en));
}

function SearchTab() {
  const [query, setQuery] = useState("");
  const { data: hits, isFetching } = useDictionarySearch(query);
  const added = useAddedWords();
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
            added={added(hit.word.en)}
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
  const added = useAddedWords();
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
            added={added(word.en)}
          />
        ))}
      </ul>
    </div>
  );
}

export function AddWordPanel() {
  const added = useAddedWords();
  // Вкладка — в URL (?tab=inbox): команда iOS после отправки скриншота открывает сразу «Входящие».
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") ?? "search";
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => setParams({ tab: value }, { replace: true })}
    >
      <TabsList className="grid w-full grid-cols-[repeat(auto-fit,minmax(5rem,1fr))] group-data-[orientation=horizontal]/tabs:h-auto">
        <TabsTrigger value="search">Поиск</TabsTrigger>
        <TabsTrigger value="unit">Юнит</TabsTrigger>
        <TabsTrigger value="manual">Вручную</TabsTrigger>
        <TabsTrigger value="inbox">Входящие</TabsTrigger>
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
      <TabsContent value="inbox" className="pt-2">
        <InboxTab added={added} />
      </TabsContent>
    </Tabs>
  );
}
