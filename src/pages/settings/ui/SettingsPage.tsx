import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Clock,
  Lock,
  type LucideIcon,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router";
import { useLogout, useMe } from "@/entities/session";
import { ShortcutSetup } from "@/features/api-token";
import { PushSettings } from "@/features/push-subscribe";
import { ScheduleSettings } from "@/features/schedule-settings";
import { Button } from "@/shared/ui/button";

interface Section {
  slug: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  content: () => ReactNode;
}

const SECTIONS: Section[] = [
  {
    slug: "notifications",
    title: "Уведомления",
    hint: "Включить на этом устройстве, проверить",
    icon: Bell,
    content: () => <PushSettings />,
  },
  {
    slug: "schedule",
    title: "Расписание",
    hint: "Часы, частота, лимиты в день",
    icon: Clock,
    content: () => <ScheduleSettings />,
  },
  {
    slug: "shortcut",
    title: "Быстрое добавление с iPhone",
    hint: "Ключ для приложения «Команды»",
    icon: Smartphone,
    content: () => <ShortcutSetup />,
  },
  {
    slug: "account",
    title: "Аккаунт",
    hint: "Почта, выход",
    icon: UserRound,
    content: () => <Account />,
  },
];

/** Настройки — меню разделов, каждый раздел открывается своей страницей (/settings/<раздел>). */
export function SettingsPage() {
  const { section } = useParams();
  const { data: me } = useMe();
  const open = SECTIONS.find((s) => s.slug === section);
  if (open) return <SectionPage section={open} />;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-semibold text-xl">Настройки</h1>
      <nav className="flex flex-col divide-y rounded-xl border">
        {SECTIONS.map((s) => (
          <MenuRow
            key={s.slug}
            to={`/settings/${s.slug}`}
            icon={s.icon}
            title={s.title}
            hint={s.hint}
          />
        ))}
      </nav>
      <nav className="flex flex-col divide-y rounded-xl border">
        {me?.isAdmin && (
          <MenuRow
            to="/admin"
            icon={ShieldCheck}
            title="Админка"
            hint="Заявки на вход и доступ"
          />
        )}
        <MenuRow
          to="/privacy"
          icon={Lock}
          title="Конфиденциальность"
          hint="Что хранится и как удалить"
        />
      </nav>
      <p className="text-center text-muted-foreground text-xs">
        Версия от {formatBuildTime(import.meta.env.VITE_BUILD_TIME)}
      </p>
    </div>
  );
}

function MenuRow(props: {
  to: string;
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  const Icon = props.icon;
  return (
    <Link to={props.to} className="flex items-center gap-3 p-4">
      <Icon className="size-5 shrink-0 text-muted-foreground" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-medium">{props.title}</span>
        <span className="text-muted-foreground text-xs">{props.hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

function SectionPage({ section }: { section: Section }) {
  return (
    <div className="flex flex-col gap-4">
      <Link
        to="/settings"
        className="-ml-1 flex items-center gap-1 self-start text-muted-foreground text-sm"
      >
        <ChevronLeft className="size-4" />
        Настройки
      </Link>
      <h1 className="font-semibold text-xl">{section.title}</h1>
      <section className="flex flex-col gap-2">{section.content()}</section>
    </div>
  );
}

function Account() {
  const { data: me } = useMe();
  const logout = useLogout();
  return (
    <>
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
    </>
  );
}

/** Время сборки (vite.config.ts → VITE_BUILD_TIME): по нему видно, что обновление пришло. */
function formatBuildTime(iso: string | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}
