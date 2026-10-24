import {
  Copy,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  RectangleEllipsis,
  Volume2,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { WordStatusBadge } from "@/entities/word";
import { untilText } from "@/shared/lib/format";
import { canSpeak, speak } from "@/shared/lib/speech";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { type StepRequest, useAnswerStep } from "../api/drillApi.ts";
import {
  holdKeyboard,
  keyboardHeld,
  onHeldEnter,
  releaseKeyboard,
} from "../lib/keyboard.ts";
import { useStickToVisibleTop } from "../lib/sticky.ts";
import { lengthHint } from "../lib/template.ts";
import { useAnswerStore } from "../model/store.ts";
import type { DrillCard, StepResult, Verdict } from "../model/types.ts";
import { AnswerDiff } from "./AnswerDiff.tsx";
import { HintTemplate } from "./HintTemplate.tsx";

/** Что сказать после неудачного ввода, когда открывается заготовка. */
const HINT_INTRO: Record<Verdict, string> = {
  correct: "",
  typo: "",
  partial: "Близко, но ошибок много. Подсказка:",
  // Заменяется сообщением с введённым словом — см. synonymIntro.
  synonym: "Тоже верно, но здесь загадано другое слово:",
  "other-word": "Это перевод другого слова. Подсказка:",
  wrong: "Подсказка:",
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
  lang,
}: {
  placeholder: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
  disabled: boolean;
  invalid?: boolean;
  lang: "en" | "ru";
}) {
  const [value, setValue] = useState("");
  const form = useRef<HTMLFormElement>(null);
  // Поле исчезает (ответ принят) — клавиатура остаётся открытой для следующего поля.
  useLayoutEffect(() => {
    const el = form.current;
    return () => holdKeyboard(el);
  }, []);
  const empty = value.trim() === "";
  // Пустой ответ не отправляется: на шаге ввода он значил бы «Не помню» — низший балл по случайному Enter.
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!empty) onSubmit(value);
  };
  return (
    <form ref={form} onSubmit={submit} className="flex flex-col gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        lang={lang}
        enterKeyHint="go"
        aria-invalid={invalid}
        aria-label={lang === "ru" ? "Ответ по-русски" : "Ответ по-английски"}
        className="h-12 text-lg"
      />
      <Button type="submit" size="lg" disabled={disabled || empty}>
        {submitLabel}
      </Button>
    </form>
  );
}

/** Скопировать карточку целиком — например, чтобы спросить о слове нейросеть. */
function copyCard(card: DrillCard, expected: string) {
  const text = [
    `${card.prompt} — ${expected}`,
    ...(card.alsoPrompts.length
      ? [`Другие переводы: ${card.alsoPrompts.join(", ")}`]
      : []),
  ].join("\n");
  navigator.clipboard.writeText(text).then(
    () => toast.success("Скопировано"),
    () => toast.error("Не получилось скопировать"),
  );
}

/** Произнести слово голосом системы. */
function SpeakButton({ text }: { text: string }) {
  // Пока голос готовится, крутится индикатор: первое слово ждёт загрузки, а не запинается.
  const [preparing, setPreparing] = useState(false);
  if (!canSpeak()) return null;
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label="Произнести"
      aria-busy={preparing}
      onClick={() => {
        setPreparing(true);
        speak(text).finally(() => setPreparing(false));
      }}
    >
      {preparing ? <LoaderCircle className="animate-spin" /> : <Volume2 />}
    </Button>
  );
}

function Outcome({
  card,
  result,
  via,
  onNext,
}: {
  card: DrillCard;
  result: StepResult;
  via: "type" | "hint" | "other";
  onNext: () => void;
}) {
  const nextRef = useRef<HTMLButtonElement>(null);
  const next = useRef(onNext);
  next.current = onNext;
  useEffect(() => {
    // Клавиатура открыта — оставляем её: Enter на ней = «Дальше», следующее поле сразу с клавиатурой.
    if (!keyboardHeld()) nextRef.current?.focus();
    onHeldEnter(() => next.current());
    return () => onHeldEnter(null);
  }, []);
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="break-words font-semibold text-3xl">{result.expected}</p>
        <div className="flex gap-2">
          <SpeakButton
            text={card.direction === "en-ru" ? card.prompt : result.expected}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => copyCard(card, result.expected)}
          >
            <Copy />
            Скопировать
          </Button>
        </div>
      </div>
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
  const {
    stage,
    shownAt,
    last,
    mask,
    revealed,
    hintLevel,
    wrong,
    options,
    done,
    start,
    apply,
  } = useAnswerStore();
  const step = useAnswerStep();
  const [lastInput, setLastInput] = useState("");
  /** Сколько раз отвечали на шаге подсказок — чтобы сбрасывать поле после неверной попытки. */
  const [hintTries, setHintTries] = useState(0);
  /** Что сказать после неверной попытки на шаге подсказок (null — обычное вступление). */
  const [hintNote, setHintNote] = useState<string | null>(null);
  const [showTries, setShowTries] = useState(0);
  /** До какого шага дошли: «Верно!» показываем, только если вспомнил сам (ввод или подсказки). */
  const [deepest, setDeepest] = useState<"type" | "hint" | "other">("type");

  // Карточек больше нет — клавиатуру держать незачем.
  useEffect(() => releaseKeyboard, []);
  const promptRef = useRef<HTMLHeadingElement>(null);
  useStickToVisibleTop(promptRef);
  const reverse = card.direction === "en-ru";
  const lang = reverse ? "ru" : "en";
  const writeHere = reverse ? "Напиши по-русски" : "Напиши по-английски";

  // biome-ignore lint/correctness/useExhaustiveDependencies: то же слово в другую сторону — новая карточка
  useLayoutEffect(() => {
    start(card.wordId);
    setLastInput("");
    setHintTries(0);
    setHintNote(null);
    setShowTries(0);
    setDeepest("type");
  }, [card.wordId, card.direction, start]);

  const send = (request: Omit<StepRequest, "wordId" | "direction" | "stage">) =>
    step.mutate(
      { wordId: card.wordId, direction: card.direction, stage, ...request },
      {
        onSuccess: (result) => {
          if (!request.action) setLastInput(request.input);
          if (stage === "hint" && !request.action) setHintTries((n) => n + 1);
          if (stage === "hint") {
            setHintNote(
              request.action || result.correct || result.verdict === "synonym"
                ? null
                : result.hintLevel !== hintLevel
                  ? "Не то — вот шаблон слова:"
                  : "Не то — открыл ещё одну букву:",
            );
          }
          // Ввод сразу в шаблон и мимо: шаблон тот же, вписанное остаётся — исправить или взять подсказку.
          if (
            stage === "type" &&
            card.template &&
            result.next === "hint" &&
            request.input.trim() !== "" &&
            result.verdict !== "synonym"
          ) {
            setHintNote(
              result.verdict === "other-word"
                ? "Это перевод другого слова. Исправь буквы или возьми подсказку:"
                : result.verdict === "partial"
                  ? "Близко! Исправь буквы или возьми подсказку:"
                  : "Не то. Исправь буквы или возьми подсказку:",
            );
          }
          // Шаблон заполнен целиком, но мимо — обычная ошибка: показываем, где ошибся.
          if (result.wrong?.length) {
            setHintNote(
              result.wrong.length === 1
                ? "Ошибка подчёркнута красным — исправь букву или возьми подсказку:"
                : "Ошибки подчёркнуты красным — исправь буквы или возьми подсказку:",
            );
          }
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
  /** Что вписано в шаблон: верные буквы «Ещё буква» и неверная попытка не открывают. */
  const cells = useRef<string[]>([]);
  const onCellsChange = useCallback((values: string[]) => {
    cells.current = values;
  }, []);

  const hintIntro =
    last?.verdict === "synonym"
      ? synonymIntro(lastInput)
      : (hintNote ?? (last?.verdict ? HINT_INTRO[last.verdict] : "Подсказка:"));
  const hintButtons = (
    <div className="grid grid-cols-2 gap-2">
      <Button
        variant="outline"
        size="lg"
        disabled={step.isPending}
        onClick={() =>
          send({
            input: "",
            action: "reveal",
            ...(hintLevel === 2 ? { cells: cells.current } : {}),
          })
        }
      >
        {hintLevel === 1 ? <RectangleEllipsis /> : <Lightbulb />}
        {hintLevel === 1 ? "Шаблон" : "Ещё буква"}
      </Button>
      <Button
        variant="outline"
        size="lg"
        disabled={step.isPending}
        onClick={() => send({ input: "", action: "choices" })}
      >
        <ListChecks />
        Варианты
      </Button>
    </div>
  );

  return (
    <Card>
      <CardContent
        className="flex flex-col gap-5 py-2"
        // Касание кнопки не уводит фокус из поля: клавиатура не прячется, и «Дальше» срабатывает с первого раза.
        onMouseDown={(e) => {
          if ((e.target as Element).closest("button")) e.preventDefault();
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-muted-foreground text-xs uppercase tracking-wide">
            {reverse
              ? card.isNew
                ? "новое: как по-русски"
                : card.hot
                  ? "повтор: как по-русски"
                  : "как по-русски"
              : card.isNew
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
        {/* Слово прилипает к верху экрана: длинная карточка и открытая клавиатура его не уносят.
            Прямой потомок карточки — иначе sticky держится только в пределах своего блока. */}
        <h2
          ref={promptRef}
          lang={reverse ? "en" : "ru"}
          className="-mx-2 -mt-4 sticky top-[env(safe-area-inset-top)] z-10 break-words bg-card px-2 py-1 font-semibold text-3xl"
        >
          {card.prompt}
        </h2>
        {card.alsoPrompts.length > 0 && (
          <p className="-mt-4 text-base text-muted-foreground">
            {card.alsoPrompts.join(" · ")}
          </p>
        )}

        {done?.verdict === "typo" && (
          <AnswerDiff input={lastInput} expected={done.expected} />
        )}

        {done ? (
          <Outcome card={card} result={done} via={deepest} onNext={onNext} />
        ) : stage === "type" && !card.template ? (
          <TextAnswer
            placeholder={writeHere}
            submitLabel="Проверить"
            onSubmit={answer}
            disabled={step.isPending}
            lang={lang}
          />
        ) : stage === "hint" && hintLevel === 1 ? (
          <div className="flex flex-col gap-3">
            <p className="text-base">{hintIntro}</p>
            <p className="font-semibold text-xl" data-testid="length-hint">
              {lengthHint(mask)}
            </p>
            <TextAnswer
              key={`hint-${hintTries}`}
              placeholder={writeHere}
              submitLabel="Проверить"
              onSubmit={answer}
              disabled={step.isPending}
              lang={lang}
            />
            {hintButtons}
          </div>
        ) : stage === "type" || stage === "hint" ? (
          // Один и тот же шаблон на вводе и на подсказках: вписанные буквы не теряются после ошибки.
          <div className="flex flex-col gap-3">
            <p className="text-base">
              {stage === "type" ? "Впиши слово по буквам:" : hintIntro}
            </p>
            <HintTemplate
              key={`${card.wordId}-${card.direction}`}
              lang={lang}
              mask={stage === "type" ? (card.mask ?? []) : mask}
              onSubmit={(input, typed) =>
                send(
                  stage === "type"
                    ? { input, elapsedMs: Date.now() - shownAt, cells: typed }
                    : { input, cells: typed },
                )
              }
              onCellsChange={onCellsChange}
              wrong={wrong}
              disabled={step.isPending}
            />
            {stage === "hint" && (
              <>
                <p className="text-muted-foreground text-sm">
                  Подсказок: {revealed}. Каждая открытая буква — слово вернётся
                  раньше.
                </p>
                {hintButtons}
              </>
            )}
          </div>
        ) : stage === "choice" ? (
          <div className="flex flex-col gap-3">
            <p className="text-base">Выбери правильный вариант:</p>
            <div className="grid grid-cols-2 gap-2" data-testid="choices">
              {options.map((option) => (
                <Button
                  key={option}
                  variant="outline"
                  size="lg"
                  className="h-auto min-h-14 whitespace-normal text-lg"
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
            <p className="text-base">
              {showTries > 0
                ? "Не совпало — перепиши точно:"
                : "Правильный ответ — перепиши его, чтобы запомнить:"}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold text-2xl">{last?.expected}</p>
              {last?.expected && card.direction === "ru-en" && (
                <SpeakButton text={last.expected} />
              )}
            </div>
            <TextAnswer
              key={`show-${showTries}`}
              placeholder="Перепиши слово"
              submitLabel="Готово"
              onSubmit={answer}
              disabled={step.isPending}
              invalid={showTries > 0}
              lang={lang}
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
