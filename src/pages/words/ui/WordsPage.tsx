import { useWords } from "@/entities/word";
import { AddWordPanel } from "@/features/add-word";
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
        <h2 className="font-semibold text-xl">
          Мои слова{words?.length ? ` (${words.length})` : ""}
        </h2>
        <WordList />
      </section>
    </div>
  );
}
