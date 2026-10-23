import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  useDictionarySearch,
  useUnits,
  useUnitWords,
} from "@/entities/dictionary";
import { useWords, type Word } from "@/entities/word";
import { normalize } from "@/shared/lib/answer-check";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { wordsByAnswer } from "../model/existing.ts";
import { filterUnits } from "../model/units.ts";
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

/** Сколько тем показать списком — дальше просим уточнить поиск. */
const UNITS_SHOWN = 30;

function UnitTab() {
  const { data: units } = useUnits();
  const [query, setQuery] = useState("");
  const [unit, setUnit] = useState<number | null>(null);
  const { data } = useUnitWords(unit);
  const added = useAddedWords();
  const found = useMemo(() => filterUnits(units ?? [], query), [units, query]);
  const picked = units?.find((u) => u.n === unit);

  if (picked) {
    return (
      <div className="flex flex-col gap-3">
        <Button
          variant="outline"
          className="self-start"
          onClick={() => setUnit(null)}
        >
          <ArrowLeft />
          Все темы
        </Button>
        <div className="flex flex-col gap-0.5">
          <h3 className="font-semibold text-lg">{picked.goal}</h3>
          <p className="text-muted-foreground text-sm">
            {picked.title} · тема {picked.n}
          </p>
        </div>
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

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        placeholder="Тема: семья, еда, брак…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        aria-label="Поиск темы курса"
      />
      <p className="text-muted-foreground text-sm">
        Темы и слова — из курса Duolingo (по данным duome.eu). Номер темы может
        не совпадать с твоим путём в Duolingo.
      </p>
      {units && found.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Такой темы не нашлось — попробуй другое слово.
        </p>
      )}
      <ul className="flex flex-col gap-2">
        {found.slice(0, UNITS_SHOWN).map((u) => (
          <li key={u.n}>
            <button
              type="button"
              onClick={() => setUnit(u.n)}
              className="flex w-full flex-col items-start gap-0.5 rounded-lg border p-3 text-left hover:bg-muted"
            >
              <span className="font-medium text-base">{u.goal}</span>
              <span className="text-muted-foreground text-sm">
                {u.title} · тема {u.n}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {found.length > UNITS_SHOWN && (
        <p className="text-muted-foreground text-sm">
          Показано {UNITS_SHOWN} из {found.length} — уточни поиск.
        </p>
      )}
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
        <TabsTrigger value="unit">Темы</TabsTrigger>
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
