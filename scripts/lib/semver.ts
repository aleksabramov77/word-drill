// Версии приложения — major.minor.patch (1.0.0): исправление → patch, новая возможность → minor,
// крупная переделка → major.

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

export function parseVersion(version: string): [number, number, number] {
  const match = SEMVER.exec(version.trim());
  if (!match) throw new Error(`версия «${version}» — не major.minor.patch`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** < 0 — a старше b, 0 — равны, > 0 — a новее b. */
export function compareVersions(a: string, b: string): number {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    const diff = pa[i]! - pb[i]!;
    if (diff !== 0) return diff;
  }
  return 0;
}
