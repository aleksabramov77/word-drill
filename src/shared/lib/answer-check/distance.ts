// Расстояние Дамерау–Левенштейна (вариант OSA): вставка, удаление, замена и перестановка соседних букв.
// Замена на соседнюю клавишу QWERTY стоит половину ошибки — это промах пальцем, а не незнание слова.
const ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const ADJACENT_COST = 0.5;

const KEY_POSITIONS = new Map<string, readonly [number, number]>();
ROWS.forEach((row, r) => {
  [...row].forEach((key, c) => {
    KEY_POSITIONS.set(key, [r, c]);
  });
});

// Ряды клавиатуры сдвинуты: под клавишей (r, c) лежат (r+1, c-1) и (r+1, c), над ней — (r-1, c) и (r-1, c+1).
export function areAdjacentKeys(a: string, b: string): boolean {
  const pa = KEY_POSITIONS.get(a);
  const pb = KEY_POSITIONS.get(b);
  if (!pa || !pb || a === b) return false;
  const [ra, ca] = pa;
  const [rb, cb] = pb;
  if (ra === rb) return Math.abs(ca - cb) === 1;
  if (rb === ra + 1) return cb === ca - 1 || cb === ca;
  if (rb === ra - 1) return cb === ca || cb === ca + 1;
  return false;
}

function substitutionCost(a: string, b: string): number {
  if (a === b) return 0;
  return areAdjacentKeys(a, b) ? ADJACENT_COST : 1;
}

export function typoDistance(source: string, target: string): number {
  const s = [...source];
  const t = [...target];
  const rows = s.length + 1;
  const cols = t.length + 1;
  const d: number[][] = Array.from({ length: rows }, () =>
    new Array<number>(cols).fill(0),
  );
  const at = (i: number, j: number) => d[i]?.[j] ?? 0;

  for (let i = 0; i < rows; i++) d[i]![0] = i;
  for (let j = 0; j < cols; j++) d[0]![j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const si = s[i - 1]!;
      const tj = t[j - 1]!;
      let best = Math.min(
        at(i - 1, j) + 1,
        at(i, j - 1) + 1,
        at(i - 1, j - 1) + substitutionCost(si, tj),
      );
      if (i > 1 && j > 1 && si === t[j - 2] && s[i - 2] === tj) {
        best = Math.min(best, at(i - 2, j - 2) + 1);
      }
      d[i]![j] = best;
    }
  }
  return at(rows - 1, cols - 1);
}
