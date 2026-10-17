import { Lightbulb, ListChecks } from "lucide-react";
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
import { type StepRequest, useAnswerStep } from "../api/drillApi.ts";
import { useAnswerStore } from "../model/store.ts";
import type { DrillCard, StepResult, Verdict } from "../model/types.ts";
import { AnswerDiff } from "./AnswerDiff.tsx";
import { HintMask } from "./HintMask.tsx";

/** Что сказать после неудачного ввода, когда открывается заготовка. */
const HINT_INTRO: Record<Verdict, string> = {
  correct: "",
  typo: "",
  partial: "Близко, но ошибок много. Вспомни по подсказке:",
  // Заменяется сообщением с введённым словом — см. synonymIntro.
  synonym: "Тоже верно, но здесь загадано другое слово:",
  "other-word": "Это перевод другого слова. Вспомни по подсказке:",
  wrong: "Вспомни по подсказке:",
};

/** Введён другой верный перевод: не ошибка, буквы не открываются. */
function synonymIntro(input: string): string {
  return `«${input.trim()}» — тоже верно! Но здесь загадано другое слово:`;
}

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
  const empty = value.trim() === "";
  // Пустой ответ не отправляется: на шаге ввода он значил бы «Не помню» — низший балл по случайному Enter.
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!empty) onSubmit(value);
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
      <Button type="submit" size="lg" disabled={disabled || empty}>
        {submitLabel}
      </Button>
    </form>
  );
}

function Outcome({
  result,
  via,
  onNext,
}: {
  result: StepResult;
  via: "type" | "hint" | "other";
  onNext: () => void;
}) {
  const nextRef = useRef<HTMLButtonElement>(null);
  useEffect(() => nextRef.current?.focus(), []);
  const typed = via !== "other";
  const title = !typed
    ? "Запомни:"
    : result.verdict === "typo"
      ? "Почти! Знаешь, но с ошибкой"
      : via === "hint"
        ? "Верно, с подсказкой"
        : "Верно!";
  return (
    <div className="flex flex-col gap-3">
      <p
        className={cn(
          "font-medium text-lg",
          typed && result.verdict === "correct" && "text-success",
          typed && result.verdict === "typo" && "text-amber-600",
        )}
      >
        {title}
      </p>
      <p className="font-semibold text-2xl">{result.expected}</p>
      {result.outcome && (
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground text-sm">
          <WordStatusBadge status={result.outcome.status} />
          знание {Math.round(result.outcome.knowledge * 100)}% · снова{" "}
          {untilText(new Date(result.outcome.due))}
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
  const { stage, shownAt, last, mask, revealed, options, done, start, apply } =
    useAnswerStore();
  const step = useAnswerStep();
  const [lastInput, setLastInput] = useState("");
  /** Сколько раз отвечали на шаге подсказок — чтобы сбрасывать поле после неверной попытки. */
  const [hintTries, setHintTries] = useState(0);
  const [showTries, setShowTries] = useState(0);
  /** До какого шага дошли: «Верно!» показываем, только если вспомнил сам (ввод или подсказки). */
  const [deepest, setDeepest] = useState<"type" | "hint" | "other">("type");

  useLayoutEffect(() => {
    start(card.wordId);
    setLastInput("");
    setHintTries(0);
    setShowTries(0);
    setDeepest("type");
  }, [card.wordId, start]);

  const send = (request: Omit<StepRequest, "wordId" | "stage">) =>
    step.mutate(
      { wordId: card.wordId, stage, ...request },
      {
        onSuccess: (result) => {
          if (!request.action) setLastInput(request.input);
          if (stage === "hint" && !request.action) setHintTries((n) => n + 1);
          if (stage === "show" && !result.correct) setShowTries((n) => n + 1);
          if (result.next === "choice" || result.next === "show") {
            setDeepest("other");
          } else if (result.next === "hint") {
            setDeepest((d) => (d === "type" ? "hint" : d));
          }
          apply(result);
        },
      },
    );
  const answer = (input: string) =>
    send(
      stage === "type" ? { input, elapsedMs: Date.now() - shownAt } : { input },
    );

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-xs uppercase tracking-wide">
              {card.isNew
                ? "новое слово"
                : card.hot
                  ? "повтор"
                  : "как по-английски"}
            </span>
            {/* Наверху, подальше от «Проверить»: случайное нажатие — сразу низший балл. */}
            {stage === "type" && !done && (
              <Button
                variant="outline"
                size="sm"
                disabled={step.isPending}
                onClick={() => answer("")}
              >
                Не помню
              </Button>
            )}
          </div>
          <h2 className="font-semibold text-3xl">{card.prompt}</h2>
          {card.alsoPrompts.length > 0 && (
            <p className="text-muted-foreground text-sm">
              {card.alsoPrompts.join(" · ")}
            </p>
          )}
          {stage === "type" && !done && (
            <span className="text-muted-foreground text-sm">
              {card.letters} {plural(card.letters, "буква", "буквы", "букв")}
            </span>
          )}
        </div>

        {done?.verdict === "typo" && (
          <AnswerDiff input={lastInput} expected={done.expected} />
        )}

        {done ? (
          <Outcome result={done} via={deepest} onNext={onNext} />
        ) : stage === "type" ? (
          <TextAnswer
            placeholder="Напиши по-английски"
            submitLabel="Проверить"
            onSubmit={answer}
            disabled={step.isPending}
          />
        ) : stage === "hint" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {last?.verdict === "synonym"
                ? synonymIntro(lastInput)
                : hintTries > 0 && last?.correct === false
                  ? "Не то — открыл ещё одну букву:"
                  : last?.verdict
                    ? HINT_INTRO[last.verdict]
                    : "Вспомни по подсказке:"}
            </p>
            <HintMask mask={mask} />
            <p className="text-muted-foreground text-xs">
              Подсказок: {revealed}. Каждая открытая буква — слово вернётся
              раньше.
            </p>
            <TextAnswer
              key={`hint-${hintTries}`}
              placeholder="Допиши слово"
              submitLabel="Проверить"
              onSubmit={answer}
              disabled={step.isPending}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                disabled={step.isPending}
                onClick={() => send({ input: "", action: "reveal" })}
              >
                <Lightbulb />
                Ещё буква
              </Button>
              <Button
                variant="outline"
                disabled={step.isPending}
                onClick={() => send({ input: "", action: "choices" })}
              >
                <ListChecks />
                Варианты
              </Button>
            </div>
          </div>
        ) : stage === "choice" ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm">Выбери правильный вариант:</p>
            <div className="grid grid-cols-2 gap-2" data-testid="choices">
              {options.map((option) => (
                <Button
                  key={option}
                  variant="outline"
                  size="lg"
                  className="h-auto min-h-12 whitespace-normal"
                  disabled={step.isPending}
                  onClick={() => answer(option)}
                >
                  {option}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              {showTries > 0
                ? "Не совпало — перепиши точно:"
                : "Правильный ответ — перепиши его, чтобы запомнить:"}
            </p>
            <p className="font-semibold text-2xl">{last?.expected}</p>
            <TextAnswer
              key={`show-${showTries}`}
              placeholder="Перепиши слово"
              submitLabel="Готово"
              onSubmit={answer}
              disabled={step.isPending}
              invalid={showTries > 0}
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
