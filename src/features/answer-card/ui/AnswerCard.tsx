import {
  type FormEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { WordStatusBadge } from "@/entities/word";
import { plural, untilText } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { useAnswerStep } from "../api/drillApi.ts";
import { useAnswerStore } from "../model/store.ts";
import type { DrillCard, StepResult, Verdict } from "../model/types.ts";
import { AnswerDiff } from "./AnswerDiff.tsx";

const VERDICT_TEXT: Record<Verdict, string> = {
  correct: "Верно!",
  typo: "Почти! Знаешь, но с ошибкой",
  partial: "Близко, но ошибок много — выбери правильный вариант",
  "other-word": "Это перевод другого слова — выбери правильный вариант",
  wrong: "Не то — выбери правильный вариант",
};

function TextAnswer({
  placeholder,
  submitLabel,
  onSubmit,
  disabled,
  invalid,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
  disabled: boolean;
  invalid?: boolean;
}) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit(value);
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        lang="en"
        enterKeyHint="go"
        aria-invalid={invalid}
        aria-label="Ответ по-английски"
        className="h-12 text-lg"
      />
      <Button type="submit" size="lg" disabled={disabled}>
        {submitLabel}
      </Button>
    </form>
  );
}

function Outcome({
  result,
  onNext,
}: {
  result: StepResult;
  onNext: () => void;
}) {
  const last = useAnswerStore((s) => s.last);
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => nextRef.current?.focus(), []);
  const typed = last?.verdict;
  return (
    <div className="flex flex-col gap-3">
      <p
        className={cn(
          "font-medium text-lg",
          typed === "correct"
            ? "text-success"
            : typed === "typo"
              ? "text-amber-600"
              : "",
        )}
      >
        {typed === "correct" || typed === "typo"
          ? VERDICT_TEXT[typed]
          : "Запомни:"}
      </p>
      <p className="font-semibold text-2xl">{result.expected}</p>
      {result.outcome && (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <WordStatusBadge status={result.outcome.status} />
          снова {untilText(new Date(result.outcome.due))}
        </p>
      )}
      <Button ref={nextRef} size="lg" onClick={onNext}>
        Дальше
      </Button>
    </div>
  );
}

export function AnswerCard({
  card,
  onNext,
}: {
  card: DrillCard;
  onNext: () => void;
}) {
  const { stage, shownAt, last, options, done, start, apply } =
    useAnswerStore();
  const step = useAnswerStep();
  const [typedInput, setTypedInput] = useState("");

  useLayoutEffect(() => {
    start(card.wordId);
    setTypedInput("");
  }, [card.wordId, start]);

  const send = (input: string) =>
    step.mutate(
      {
        wordId: card.wordId,
        stage,
        input,
        ...(stage === "type" ? { elapsedMs: Date.now() - shownAt } : {}),
      },
      {
        onSuccess: (result) => {
          if (stage === "type") setTypedInput(input);
          apply(result);
        },
      },
    );

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-2">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            {card.isNew
              ? "новое слово"
              : card.hot
                ? "повтор"
                : "как по-английски"}
          </span>
          <h2 className="font-semibold text-3xl">{card.prompt}</h2>
          {stage === "type" && !done && (
            <span className="text-muted-foreground text-sm">
              {card.letters} {plural(card.letters, "буква", "буквы", "букв")}
            </span>
          )}
        </div>

        {last?.verdict === "typo" && done && (
          <AnswerDiff input={typedInput} expected={last.expected} />
        )}

        {done ? (
          <Outcome result={done} onNext={onNext} />
        ) : stage === "type" ? (
          <div className="flex flex-col gap-2">
            <TextAnswer
              placeholder="Напиши по-английски"
              submitLabel="Проверить"
              onSubmit={send}
              disabled={step.isPending}
            />
            <Button
              variant="ghost"
              disabled={step.isPending}
              onClick={() => send("")}
            >
              Не помню
            </Button>
          </div>
        ) : stage === "choice" ? (
          <div className="flex flex-col gap-3">
            {last?.verdict && (
              <p className="text-sm">{VERDICT_TEXT[last.verdict]}</p>
            )}
            {last?.verdict === "partial" && (
              <AnswerDiff input={typedInput} expected={last.expected} />
            )}
            <div className="grid grid-cols-2 gap-2">
              {options.map((option) => (
                <Button
                  key={option}
                  variant="outline"
                  size="lg"
                  className="h-auto min-h-12 whitespace-normal"
                  disabled={step.isPending}
                  onClick={() => send(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {last?.correct === false &&
              last.next === "show" &&
              last.verdict === undefined
                ? "Правильный ответ — перепиши его, чтобы запомнить:"
                : "Перепиши:"}
            </p>
            <p className="font-semibold text-2xl">{last?.expected}</p>
            <TextAnswer
              key={`show-${last?.expected}`}
              placeholder="Перепиши слово"
              submitLabel="Готово"
              onSubmit={send}
              disabled={step.isPending}
              invalid={last?.next === "show" && step.isSuccess && !last.correct}
            />
          </div>
        )}

        {step.isError && (
          <p className="text-destructive text-sm">
            Не получилось отправить ответ — попробуй ещё раз.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
