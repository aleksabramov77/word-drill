// Разбор CHANGELOG.md: «## 1.9.0 — 2026-10-23», под ним «### Добавлено» и пункты «- …».

export interface ChangelogGroup {
  title: string;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  date: string;
  groups: ChangelogGroup[];
}

const RELEASE = /^##\s+(\d+\.\d+\.\d+)\s*(?:—|-)?\s*(.*)$/;

export function parseChangelog(markdown: string): ChangelogRelease[] {
  const releases: ChangelogRelease[] = [];
  for (const raw of markdown.split("\n")) {
    const line = raw.trim();
    const release = RELEASE.exec(line);
    if (release) {
      releases.push({
        version: release[1] ?? "",
        date: (release[2] ?? "").trim(),
        groups: [],
      });
      continue;
    }
    const current = releases[releases.length - 1];
    if (!current) continue;
    if (line.startsWith("### ")) {
      current.groups.push({ title: line.slice(4).trim(), items: [] });
    } else if (line.startsWith("- ")) {
      current.groups[current.groups.length - 1]?.items.push(line.slice(2));
    }
  }
  return releases;
}

/** Есть ли в истории запись для версии. */
export function hasRelease(markdown: string, version: string): boolean {
  return parseChangelog(markdown).some(
    (r) => r.version === version && r.groups.some((g) => g.items.length > 0),
  );
}
