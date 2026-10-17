import { GOOGLE_LOGIN_URL } from "@/entities/session";
import { Button } from "@/shared/ui/button";

const ERRORS: Record<string, string> = {
  forbidden:
    "Доступ для этой почты не открыт. Напиши владельцу — или войди другим аккаунтом Google.",
  state: "Вход прервался. Попробуй ещё раз.",
  google: "Google не подтвердил вход. Попробуй ещё раз.",
};

export function LoginPage() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get("error");
  const pending = params.get("status") === "pending";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 p-4">
      <div className="flex flex-col gap-2">
        <h1 className="font-semibold text-3xl">Word Drill</h1>
        <p className="text-muted-foreground">
          Тренажёр английских слов, которые никак не запоминаются.
        </p>
      </div>
      {pending && (
        <p className="rounded-lg bg-secondary p-3 text-sm">
          Заявка отправлена владельцу. Как только он её одобрит — нажми «Войти
          через Google» ещё раз.
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-destructive/10 p-3 text-destructive text-sm">
          {ERRORS[error] ?? ERRORS.google}
        </p>
      )}
      <Button asChild size="lg">
        <a href={GOOGLE_LOGIN_URL}>Войти через Google</a>
      </Button>
      <a
        href="/privacy"
        className="text-center text-muted-foreground text-xs underline"
      >
        Конфиденциальность
      </a>
    </main>
  );
}
