import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { logEvent } from "@/shared/api";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { holdKeyboard } from "../lib/keyboard.ts";
import {
  cellsPerLine,
  firstEmptySlot,
  isRevealed,
  isSlot,
  type Mask,
  nextSlot,
  prevSlot,
  splitWord,
  templateAnswer,
  templateWords,
  typeInto,
} from "../lib/template.ts";

/** Курсор в конец клетки, без выделения буквы. */
function caretToEnd(cell: HTMLInputElement | null | undefined) {
  if (!cell) return;
  const end = cell.value.length;
  if (cell.selectionStart !== end || cell.selectionEnd !== end) {
    cell.setSelectionRange(end, end);
  }
}

/**
 * Несколько букв разом в одну клетку — диктовка (микрофон на клавиатуре iPhone и Android,
 * диктовка Mac и Windows) или подсказка клавиатуры. Курсор тогда остаётся в клетке, а клетка
 * держит весь продиктованный текст: диктовка дописывает и исправляет его как в обычном поле,
 * а буквы каждый раз заново раскладываются по клеткам начиная с этой.
 */
interface Dictation {
  cell: number;
  /** Что было в клетке до диктовки и осталось в начале текста. */
  prefix: string;
  /** Клетки до диктовки — от них считается раскладка, чтобы исправления не оставляли лишних букв. */
  base: string[];
  /** Текст в клетке целиком — как его видит клавиатура. */
  text: string;
}

/** Промежуток между клетками и между словами, px. */
const GAP = 3;
const WORD_GAP = 16;
/** Самая узкая клетка, rem. */
const MIN_CELL_REM = 0.9;
/** Фраза до стольких клеток встаёт в одну строку; длиннее — слова переносятся, но каждое целиком. */
const ONE_LINE = 16;

/**
 * Шаблон, в который ответ вводится прямо по клеткам: тап — курсор в эту клетку,
 * после каждой буквы курсор сам идёт вправо. Открытые подсказкой буквы — красные, их не стереть.
 */
export function HintTemplate({
  mask,
  onSubmit,
  onCellsChange,
  wrong,
  disabled,
  lang = "en",
}: {
  mask: Mask;
  /** Клетки с неверными буквами после попытки — подчёркнуты красным, пока их не исправишь. */
  wrong: readonly number[];
  /** value — ответ из шаблона, cells — что вписано в каждую клетку (по индексам ответа). */
  onSubmit: (value: string, cells: string[]) => void;
  /** Вписанное — чтобы «Ещё буква» не открывала уже верно вписанные буквы. */
  onCellsChange: (cells: string[]) => void;
  disabled: boolean;
  /** Язык ответа — для клавиатуры и проверки орфографии. */
  lang?: "en" | "ru";
}) {
  // Введённое сохраняется между попытками: открытая буква просто встаёт поверх.
  const [values, setValues] = useState(() => mask.map(() => ""));
  const cells = useRef<(HTMLInputElement | null)[]>([]);
  const form = useRef<HTMLFormElement>(null);
  // Шаблон исчезает (ответ принят) — клавиатура остаётся открытой для следующего поля.
  useLayoutEffect(() => {
    const el = form.current;
    return () => holdKeyboard(el);
  }, []);
  const [dictation, setDictation] = useState<Dictation | null>(null);
  // Подсказка открыла букву — раскладка прежней диктовки больше не годится.
  // biome-ignore lint/correctness/useExhaustiveDependencies: только при смене шаблона
  useEffect(() => setDictation(null), [mask]);
  const [marked, setMarked] = useState<ReadonlySet<number>>(new Set());
  useEffect(() => setMarked(new Set(wrong)), [wrong]);
  const unmark = (indices: readonly number[]) =>
    setMarked((m) => new Set([...m].filter((i) => !indices.includes(i))));
  const focus = (i: number) => {
    const cell = cells.current[i];
    cell?.focus();
    caretToEnd(cell);
  };

  useEffect(() => onCellsChange(values), [values, onCellsChange]);

  // Неверная попытка — курсор на первую ошибку (верные буквы перебивать незачем);
  // новая подсказка — в первую пустую клетку.
  // biome-ignore lint/correctness/useExhaustiveDependencies: только при смене шаблона или ошибок
  useEffect(() => {
    const firstWrong = wrong
      .filter((i) => isSlot(mask, i))
      .sort((a, b) => a - b)[0];
    focus(firstWrong ?? firstEmptySlot(mask, values));
  }, [mask, wrong]);

  // Ширина строки — чтобы слово длиннее строки разбить со знаком переноса, а не как попало.
  const box = useRef<HTMLDivElement>(null);
  const [lineWidth, setLineWidth] = useState(Number.POSITIVE_INFINITY);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setLineWidth(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setLineWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const rootPx =
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) ||
    16;
  const perLine = cellsPerLine(lineWidth, MIN_CELL_REM * rootPx, GAP);
  // Перестроились строки (повернули экран) — курсор остаётся в той же клетке.
  const focused = useRef<number | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: только при смене числа клеток в строке
  useLayoutEffect(() => {
    if (focused.current !== null && document.activeElement === document.body) {
      focus(focused.current);
    }
  }, [perLine]);

  const words = templateWords(mask);
  const longest = Math.max(1, ...words.map((w) => w.length));
  const total = words.reduce((n, w) => n + w.length, 0);
  // Клетки сужаются, чтобы короткая фраза встала в одну строку, а длинное слово — целиком.
  const [cellsInLine, gaps] =
    total <= ONE_LINE
      ? [total, (total - words.length) * GAP + (words.length - 1) * WORD_GAP]
      : [longest, (longest - 1) * GAP];
  const width = `clamp(0.9rem, calc((100cqw - ${gaps}px) / ${cellsInLine}), 2.25rem)`;
  // Шрифт не меньше 16px — иначе iPhone приближает страницу при касании клетки.
  const cellStyle: CSSProperties = {
    width,
    fontSize: `clamp(1rem, calc(${width} * 0.7), 1.375rem)`,
  };

  const filled = mask.some((ch, i) => ch === null && values[i]);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (filled) onSubmit(templateAnswer(mask, values), values);
  };

  const dictate = (d: Dictation, raw: string) => {
    const said = raw.startsWith(d.prefix) ? raw.slice(d.prefix.length) : raw;
    // Диктовка ставит заглавную букву и точку, а иногда пробел в начале — они не нужны.
    const typed = typeInto(
      mask,
      d.base,
      d.cell,
      said.trimStart().toLowerCase(),
    );
    setValues(typed.values);
    unmark(typed.values.flatMap((v, j) => (v !== values[j] ? [j] : [])));
    setDictation({ ...d, text: raw });
  };

  const change = (i: number, raw: string, inputType?: string) => {
    if (dictation?.cell === i) {
      dictate(dictation, raw);
      return;
    }
    if (raw === "") {
      setValues((v) => v.map((x, j) => (j === i ? "" : x)));
      unmark([i]);
      return;
    }
    // Курсор всегда после буквы клетки: новая буква приходит следом за старой — берём только новую.
    // Пробел с экранной клавиатуры (iOS не всегда присылает keydown) — игнорируем.
    if (raw.trim() === (values[i] ?? "")) {
      caretToEnd(cells.current[i]);
      return;
    }
    const old = values[i] ?? "";
    const text =
      old && raw.length > 1 && raw.startsWith(old)
        ? raw.slice(old.length)
        : raw;
    if (text.trim().length > 1) {
      // Журнал: как диктуют разные телефоны — чтобы чинить по фактам, а не наугад.
      logEvent("dictation", { inputType, length: text.length });
      dictate(
        {
          cell: i,
          prefix: text === raw ? "" : old,
          base: values.map((v, j) => (j === i ? "" : v)),
          text: raw,
        },
        raw,
      );
      return;
    }
    const typed = typeInto(mask, values, i, text);
    setValues(typed.values);
    unmark(typed.values.flatMap((v, j) => (v !== values[j] ? [j] : [])));
    focus(typed.cursor);
  };

  const keyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    // Во время диктовки клетка — обычное поле: стирание, пробел и стрелки работают как в нём.
    if (dictation?.cell === i) return;
    if (e.key === "Backspace" && !values[i]) {
      e.preventDefault();
      const prev = prevSlot(mask, i);
      if (prev < 0) return;
      setValues((v) => v.map((x, j) => (j === prev ? "" : x)));
      focus(prev);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prev = prevSlot(mask, i);
      if (prev >= 0) focus(prev);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const next = nextSlot(mask, i + 1);
      if (next >= 0) focus(next);
    } else if (e.key === " ") {
      // Пробел не нужен: после последней буквы слова курсор сам уходит в следующее.
      e.preventDefault();
    }
  };

  const cell = (i: number) => {
    if (isSlot(mask, i)) {
      const dictating = dictation?.cell === i;
      return (
        // Обёртка — чтобы во время диктовки показать поверх клетки её букву, а не весь текст.
        <span key={i} className="relative inline-flex" style={cellStyle}>
          <input
            ref={(el) => {
              cells.current[i] = el;
            }}
            value={dictating ? dictation.text : (values[i] ?? "")}
            onChange={(e) =>
              change(i, e.target.value, (e.nativeEvent as InputEvent).inputType)
            }
            onKeyDown={(e) => keyDown(i, e)}
            onFocus={(e) => {
              focused.current = i;
              caretToEnd(e.currentTarget);
            }}
            onBlur={() => {
              if (dictating) setDictation(null);
            }}
            // Выделение в клетках бессмысленно (одна буква) и мешает — сразу схлопываем его.
            // Во время диктовки не трогаем: клавиатура сама ставит курсор в продиктованном тексте.
            onSelect={(e) => {
              if (!dictating) caretToEnd(e.currentTarget);
            }}
            className={cn(
              "h-11 w-full select-none rounded-t-sm border-foreground/40 border-b-2 bg-muted/40 p-0 text-center caret-transparent outline-none [-webkit-touch-callout:none] selection:bg-transparent focus:border-b-4 focus:border-primary focus:bg-primary/25 focus:ring-2 focus:ring-primary focus:ring-inset",
              marked.has(i) &&
                "border-destructive text-destructive focus:border-destructive focus:bg-destructive/15 focus:ring-destructive",
              dictating && "text-transparent",
            )}
            aria-invalid={marked.has(i) || undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            lang={lang}
            enterKeyHint="go"
            aria-label={`Буква ${i + 1}`}
          />
          {dictating && (
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              {values[i]}
            </span>
          )}
        </span>
      );
    }
    return (
      <span
        key={i}
        style={cellStyle}
        className={cn(
          "inline-flex h-11 items-center justify-center",
          isRevealed(mask, i) &&
            "border-hint border-b-2 font-semibold text-hint",
        )}
        data-revealed={isRevealed(mask, i) || undefined}
      >
        {mask[i]}
      </span>
    );
  };

  // Слово целиком в строке; длиннее строки — по кускам, в конце куска серая стрелка переноса.
  const renderWord = (word: number[]) => {
    // Разметка одна и та же для целого и разбитого слова — клетки не пересоздаются.
    const lines = splitWord(word, perLine);
    const parts = lines.map((line, n) => (
      <div key={line[0]} className="flex" style={{ gap: `${GAP}px` }}>
        {line.map(cell)}
        {n < lines.length - 1 && (
          <span
            style={cellStyle}
            className="inline-flex h-11 items-center justify-center text-muted-foreground text-xl"
            aria-hidden
            data-testid="wrap-mark"
          >
            →
          </span>
        )}
      </div>
    ));
    return (
      <div key={word[0]} className="flex flex-col gap-y-3">
        {parts}
      </div>
    );
  };

  return (
    <form ref={form} onSubmit={submit} className="flex flex-col gap-3">
      <div
        ref={box}
        className="flex select-none flex-wrap gap-y-3 font-mono"
        style={{ containerType: "inline-size", columnGap: `${WORD_GAP}px` }}
        data-testid="hint-mask"
      >
        {words.map(renderWord)}
      </div>
      <Button type="submit" size="lg" disabled={disabled || !filled}>
        Проверить
      </Button>
    </form>
  );
}
