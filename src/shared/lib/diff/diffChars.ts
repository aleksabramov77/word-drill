// Побуквенное сравнение ответа с правильным словом (наибольшая общая подпоследовательность) — для подсветки ошибок.
export type DiffPart =
  | { kind: "same"; text: string }
  /** Буква есть в правильном слове, но пропущена в ответе. */
  | { kind: "missing"; text: string }
  /** Лишняя буква в ответе. */
  | { kind: "extra"; text: string };

export function diffChars(input: string, expected: string): DiffPart[] {
  const a = [...input];
  const b = [...expected];
  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i]![j] =
        a[i]!.toLowerCase() === b[j]!.toLowerCase()
          ? lcs[i + 1]![j + 1]! + 1
          : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const parts: DiffPart[] = [];
  const push = (kind: DiffPart["kind"], ch: string) => {
    const last = parts.at(-1);
    if (last?.kind === kind) last.text += ch;
    else parts.push({ kind, text: ch });
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i]!.toLowerCase() === b[j]!.toLowerCase()) {
      push("same", b[j]!);
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      push("extra", a[i]!);
      i++;
    } else {
      push("missing", b[j]!);
      j++;
    }
  }
  while (i < a.length) push("extra", a[i++]!);
  while (j < b.length) push("missing", b[j++]!);
  return parts;
}
