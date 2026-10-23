import { APP_VERSION } from "@/shared/config";
import { parseChangelog } from "@/shared/lib/changelog";
import changelog from "../../../../../CHANGELOG.md?raw";
import { Article, Bullets, H2 } from "./parts.tsx";

const RELEASES = parseChangelog(changelog);

/** История обновлений из CHANGELOG.md — по версиям, свежие сверху. */
export function WhatsNew() {
  return (
    <Article>
      <p>
        Сейчас у тебя версия <b>{APP_VERSION}</b>.
      </p>
      {RELEASES.map((release) => (
        <section key={release.version} className="flex flex-col gap-2">
          <H2>
            {release.version}
            <span className="ml-2 font-normal text-muted-foreground">
              {release.date}
            </span>
          </H2>
          {release.groups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              <p className="font-medium">{group.title}</p>
              <Bullets>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </Bullets>
            </div>
          ))}
        </section>
      ))}
    </Article>
  );
}
