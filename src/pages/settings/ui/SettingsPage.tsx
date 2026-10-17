import { useLogout, useMe } from "@/entities/session";
import { Button } from "@/shared/ui/button";

export function SettingsPage() {
  const { data: me } = useMe();
  const logout = useLogout();
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-xl">Настройки</h1>
      <section className="flex flex-col gap-2 rounded-xl border p-4">
        <h2 className="font-medium">Аккаунт</h2>
        <p className="text-sm">
          {me?.user.name && <span>{me.user.name} · </span>}
          <span className="text-muted-foreground">{me?.user.email}</span>
        </p>
        {me?.mode === "google" && (
          <Button
            variant="outline"
            className="self-start"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            Выйти
          </Button>
        )}
      </section>
    </div>
  );
}
