import { diffChars } from "@/shared/lib/diff";

/** Ответ с подсветкой: пропущенные буквы — зелёным подчёркнутым, лишние — красным зачёркнутым. */
export function AnswerDiff({
  input,
  expected,
}: {
  input: string;
  expected: string;
}) {
  return (
    <span className="font-mono text-lg tracking-wide">
      {diffChars(input.trim(), expected).map((part, i) => {
        const key = `${i}-${part.kind}`;
        if (part.kind === "missing") {
          return (
            <span key={key} className="text-success underline decoration-2">
              {part.text}
            </span>
          );
        }
        if (part.kind === "extra") {
          return (
            <span key={key} className="text-destructive line-through">
              {part.text}
            </span>
          );
        }
        return <span key={key}>{part.text}</span>;
      })}
    </span>
  );
}
