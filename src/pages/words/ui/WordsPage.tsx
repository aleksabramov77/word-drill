import { Download } from "lucide-react";
import { useWords } from "@/entities/word";
import { AddWordPanel } from "@/features/add-word";
import { Button } from "@/shared/ui/button";
import { WordList } from "@/widgets/word-list";

export function WordsPage() {
  const { data: words } = useWords();
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2">
        <h1 className="font-semibold text-xl">Добавить слово</h1>
        <AddWordPanel />
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-xl">
            Мои слова{words?.length ? ` (${words.length})` : ""}
          </h2>
          {/* Таблица для Excel, Numbers, Google Таблиц: слова, статус, знание, сроки. */}
          {words?.length ? (
            <Button asChild variant="outline" size="sm">
              <a href="/api/words/export.csv" download>
                <Download />
                Скачать CSV
              </a>
            </Button>
          ) : null}
        </div>
        <WordList />
      </section>
    </div>
  );
}
