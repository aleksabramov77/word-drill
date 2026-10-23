import type { ReactNode } from "react";

// Кирпичики статей справки: одинаковые заголовки, шаги, заметки и внешние ссылки.

export function Article({ children }: { children: ReactNode }) {
  return (
    <article className="flex flex-col gap-3 text-base leading-relaxed">
      {children}
    </article>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mt-2 font-semibold text-lg">{children}</h2>;
}

export function Steps({ children }: { children: ReactNode }) {
  return <ol className="flex list-decimal flex-col gap-1 pl-5">{children}</ol>;
}

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>;
}

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg bg-secondary p-3 text-muted-foreground text-sm">
      {children}
    </p>
  );
}

export function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="underline">
      {children}
    </a>
  );
}
