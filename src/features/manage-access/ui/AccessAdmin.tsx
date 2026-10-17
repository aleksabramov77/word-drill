import { Check, Search, Trash2, UserPlus, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { ApiError } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  type AccessEntry,
  useAccess,
  useDecide,
  useRemoveAccess,
} from "../api/accessApi.ts";

function when(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleString("ru", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}

function Person({ entry }: { entry: Pick<AccessEntry, "email" | "name"> }) {
  return (
    <span className="min-w-0 truncate">
      {entry.name && <span className="font-medium">{entry.name} · </span>}
      <span className="text-muted-foreground">{entry.email}</span>
    </span>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty?: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="flex flex-col gap-2 rounded-xl border p-4">
      <h2 className="font-medium">{title}</h2>
      {children.length === 0 ? (
        <p className="text-muted-foreground text-sm">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-2">{children}</ul>
      )}
    </section>
  );
}

/** Админка: заявки на вход, кто может входить, отклонённые; пустить почту заранее. */
export function AccessAdmin() {
  const { data, isLoading } = useAccess();
  const decide = useDecide();
  const remove = useRemoveAccess();
  const [email, setEmail] = useState("");
  const [query, setQuery] = useState("");

  const act = (email: string, status: "approved" | "denied") =>
    decide.mutate(
      { email, status },
      {
        onSuccess: () =>
          toast.success(
            status === "approved" ? `Пускаем: ${email}` : `Закрыто: ${email}`,
          ),
      },
    );

  const invite = (e: FormEvent) => {
    e.preventDefault();
    decide.mutate(
      { email, status: "approved" },
      {
        onSuccess: () => {
          toast.success(`Пускаем: ${email.trim()}`);
          setEmail("");
        },
        onError: (error) =>
          toast.error(
            error instanceof ApiError && error.status === 400
              ? "Это не похоже на почту"
              : "Не получилось",
          ),
      },
    );
  };

  if (isLoading || !data) {
    return <p className="text-muted-foreground">Загрузка…</p>;
  }
  // Поиск по всем, кто подавал заявку или кого пускали: почта и имя, без регистра.
  const q = query.trim().toLowerCase();
  const found = data.entries.filter(
    (e) => !q || `${e.email} ${e.name}`.toLowerCase().includes(q),
  );
  const pending = found.filter((e) => e.status === "pending");
  const approved = found.filter((e) => e.status === "approved");
  const denied = found.filter((e) => e.status === "denied");
  const wordsByEmail = new Map(data.users.map((u) => [u.email, u.words]));
  const busy = decide.isPending || remove.isPending;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по почте или имени"
          aria-label="Поиск по заявкам"
          className="pl-9"
        />
      </div>
      <Section
        title={`Заявки (${pending.length})`}
        empty={q ? "Ничего не нашлось." : "Новых заявок нет."}
      >
        {pending.map((entry) => (
          <li key={entry.email} className="flex flex-col gap-2">
            <Person entry={entry} />
            <span className="text-muted-foreground text-xs">
              {when(entry.requestedAt)}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={busy}
                onClick={() => act(entry.email, "approved")}
              >
                <Check />
                Одобрить
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => act(entry.email, "denied")}
              >
                <X />
                Отклонить
              </Button>
            </div>
          </li>
        ))}
      </Section>

      <Section title="Могут входить">
        {[
          ...data.admins
            .filter((admin) => !q || admin.includes(q))
            .map((admin) => (
              <li
                key={admin}
                className="flex items-center justify-between gap-2"
              >
                <Person entry={{ email: admin, name: "" }} />
                <span className="shrink-0 text-muted-foreground text-xs">
                  админ · слов {wordsByEmail.get(admin) ?? 0}
                </span>
              </li>
            )),
          ...approved.map((entry) => (
            <li
              key={entry.email}
              className="flex items-center justify-between gap-2"
            >
              <Person entry={entry} />
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-muted-foreground text-xs">
                  слов {wordsByEmail.get(entry.email) ?? 0}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Закрыть доступ ${entry.email}`}
                  onClick={() => act(entry.email, "denied")}
                >
                  <X />
                  Закрыть
                </Button>
              </div>
            </li>
          )),
        ]}
      </Section>

      <section className="flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="font-medium">Пустить почту заранее</h2>
        <form onSubmit={invite} className="flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="friend@gmail.com"
            aria-label="Почта Google"
            autoCapitalize="none"
          />
          <Button type="submit" disabled={busy || !email.trim()}>
            <UserPlus />
            Пустить
          </Button>
        </form>
        <p className="text-muted-foreground text-xs">
          Человек войдёт через Google с этой почтой без заявки.
        </p>
      </section>

      {denied.length > 0 && (
        <Section title="Отклонённые">
          {denied.map((entry) => (
            <li
              key={entry.email}
              className="flex items-center justify-between gap-2"
            >
              <Person entry={entry} />
              <div className="flex shrink-0 gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => act(entry.email, "approved")}
                >
                  <Check />
                  Пустить
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  aria-label={`Удалить ${entry.email} из списка`}
                  onClick={() => remove.mutate(entry.email)}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </Section>
      )}
    </div>
  );
}
