import { Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import type { Word } from "@/entities/word";
import { Button } from "@/shared/ui/button";
import {
  type InboxItem,
  useAddInboxText,
  useDeleteInboxItem,
  useInbox,
} from "../api/inboxApi.ts";
import { DictionaryWordRow } from "./DictionaryWordRow.tsx";

const PREVIEW = 120;

function InboxEntry({
  item,
  added,
}: {
  item: InboxItem;
  added: (en: string) => Word | undefined;
}) {
  const remove = useDeleteInboxItem();
  const preview =
    item.text.length > PREVIEW ? `${item.text.slice(0, PREVIEW)}…` : item.text;
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="whitespace-pre-line text-muted-foreground text-xs">
          {preview}
        </p>
        <Button
          size="sm"
          variant="ghost"
          aria-label="Убрать из входящих"
          disabled={remove.isPending}
          onClick={() => remove.mutate(item.id)}
        >
          <Trash2 />
        </Button>
      </div>
      {item.suggestions.length === 0 ? (
        <p className="text-sm">Слов из курса не нашлось — добавь вручную.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {item.suggestions.map((s) => (
            <DictionaryWordRow
              key={s.word.en}
              word={s.word}
              matched={s.matchedRu ?? undefined}
              added={added(s.word.en)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/** «Входящие»: текст со скриншота (через «Команды» iOS) или вставленный вручную → слова курса из него. */
export function InboxTab({
  added,
}: {
  added: (en: string) => Word | undefined;
}) {
  const { data: items } = useInbox();
  const addText = useAddInboxText();
  const [text, setText] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) {
      addText.mutate(text, { onSuccess: () => setText("") });
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={submit} className="flex flex-col gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Вставь текст — найду в нём слова курса"
          aria-label="Текст для разбора"
          rows={3}
          className="rounded-md border bg-transparent p-3 text-sm"
        />
        <Button
          type="submit"
          variant="outline"
          className="self-start"
          disabled={addText.isPending || !text.trim()}
        >
          Разобрать
        </Button>
      </form>
      {items?.length === 0 && (
        <p className="text-muted-foreground text-sm">
          Пусто. Сюда приходит текст со скриншотов — см. «Ещё» → «Слова со
          скриншота».
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {items?.map((item) => (
          <InboxEntry key={item.id} item={item} added={added} />
        ))}
      </ul>
    </div>
  );
}
