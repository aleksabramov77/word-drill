import { useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useAddInboxText } from "@/features/add-word";

const INBOX = "/words?tab=inbox";

/**
 * «Поделиться» → Word Drill на Android (share_target в манифесте, vite.config.ts):
 * текст из параметров — во «Входящие», затем сразу туда же. Адрес с текстом заменяется в истории.
 */
export function SharePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const add = useAddInboxText();
  const started = useRef(false);
  const text = ["title", "text", "url"]
    .map((name) => params.get(name)?.trim())
    .filter(Boolean)
    .join("\n");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!text) {
      navigate(INBOX, { replace: true });
      return;
    }
    add.mutate(text, {
      onSuccess: () => navigate(INBOX, { replace: true }),
    });
  }, [add, navigate, text]);

  if (add.isError) {
    return (
      <div className="flex flex-col gap-3 pt-4 text-sm">
        <p>Не получилось отправить текст во «Входящие».</p>
        <Link to={INBOX} replace className="underline">
          Открыть «Входящие»
        </Link>
      </div>
    );
  }
  return (
    <p className="pt-4 text-muted-foreground text-sm">
      Отправляю во «Входящие»…
    </p>
  );
}
