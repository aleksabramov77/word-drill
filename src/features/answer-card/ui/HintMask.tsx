/** Заготовка слова: открытые буквы, на месте скрытых — клетки; у фраз — промежутки между словами. */
export function HintMask({ mask }: { mask: (string | null)[] }) {
  return (
    <div
      className="flex flex-wrap items-end gap-1 font-mono text-xl"
      data-testid="hint-mask"
    >
      {mask.map((ch, i) => {
        const key = `${i}-${ch ?? "_"}`;
        if (ch === " ") return <span key={key} className="w-4" />;
        if (ch === null) {
          return (
            <span
              key={key}
              className="inline-block h-8 w-6 border-foreground/40 border-b-2"
            />
          );
        }
        return (
          <span
            key={key}
            className="inline-block h-8 w-6 border-primary border-b-2 text-center font-semibold"
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
}
