import {
  Bell,
  BookOpenText,
  ChevronLeft,
  ChevronRight,
  Clock,
  Gauge,
  KeyRound,
  Lock,
  type LucideIcon,
  MessageSquareText,
  ScanText,
  ShieldCheck,
  Smartphone,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router";
import { useLogout, useMe } from "@/entities/session";
import { ShortcutSetup } from "@/features/api-token";
import { PushSettings } from "@/features/push-subscribe";
import { ScheduleSettings } from "@/features/schedule-settings";
import { Button } from "@/shared/ui/button";
import { InstallHelp } from "./help/InstallHelp.tsx";
import { PushHelp } from "./help/PushHelp.tsx";
import { ScoringHelp } from "./help/ScoringHelp.tsx";
import { ScreenshotHelp } from "./help/ScreenshotHelp.tsx";
import { TrainingHelp } from "./help/TrainingHelp.tsx";

interface Section {
  slug: string;
  title: string;
  hint: string;
  icon: LucideIcon;
  content: () => ReactNode;
}

interface Group {
  title: string;
  sections: Section[];
}

/** «Ещё»: настройки и справка — короткие страницы по одной теме, как в настройках телефона. */
const GROUPS: Group[] = [
  {
    title: "Настройки",
    sections: [
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
        title: "Ключ для «Команд»",
        hint: "Для добавления слов со скриншота на iPhone",
        icon: KeyRound,
        content: () => <ShortcutSetup />,
      },
      {
        slug: "account",
        title: "Аккаунт",
        hint: "Почта, выход",
        icon: UserRound,
        content: () => <Account />,
      },
    ],
  },
  {
    title: "Справка",
    sections: [
      {
        slug: "install",
        title: "Установить как приложение",
        hint: "iPhone, Android, компьютер",
        icon: Smartphone,
        content: () => <InstallHelp />,
      },
      {
        slug: "training",
        title: "Как идёт тренировка",
        hint: "Ввод, подсказки, варианты, опечатки",
        icon: BookOpenText,
        content: () => <TrainingHelp />,
      },
      {
        slug: "scoring",
        title: "Баллы и знание",
        hint: "Алгоритм FSRS, оценки, интервалы",
        icon: Gauge,
        content: () => <ScoringHelp />,
      },
      {
        slug: "push",
        title: "Как работают уведомления",
        hint: "Когда приходят и почему могут не прийти",
        icon: MessageSquareText,
        content: () => <PushHelp />,
      },
      {
        slug: "screenshot",
        title: "Слова со скриншота",
        hint: "Команда на iPhone, «Поделиться» на Android",
        icon: ScanText,
        content: () => <ScreenshotHelp />,
      },
    ],
  },
];

const SECTIONS = GROUPS.flatMap((g) => g.sections);

export function MorePage() {
  const { section } = useParams();
  const { data: me } = useMe();
  if (section) {
    const open = SECTIONS.find((s) => s.slug === section);
    return open ? (
      <SectionPage section={open} />
    ) : (
      <Navigate to="/more" replace />
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-semibold text-xl">Ещё</h1>
      {GROUPS.map((group) => (
        <MenuGroup key={group.title} title={group.title}>
          {group.sections.map((s) => (
            <MenuRow
              key={s.slug}
              to={`/more/${s.slug}`}
              icon={s.icon}
              title={s.title}
              hint={s.hint}
            />
          ))}
        </MenuGroup>
      ))}
      <MenuGroup title="О приложении">
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
      </MenuGroup>
      <p className="text-center text-muted-foreground text-xs">
        Версия от {formatBuildTime(import.meta.env.VITE_BUILD_TIME)}
      </p>
    </div>
  );
}

function MenuGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="px-1 text-muted-foreground text-xs uppercase tracking-wide">
        {title}
      </h2>
      <nav className="flex flex-col divide-y rounded-xl border">{children}</nav>
    </section>
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
    <Link to={props.to} className="flex items-center gap-3 px-4 py-3">
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
        to="/more"
        className="-ml-1 flex items-center gap-1 self-start text-muted-foreground text-sm"
      >
        <ChevronLeft className="size-4" />
        Ещё
      </Link>
      <h1 className="font-semibold text-xl">{section.title}</h1>
      <div className="flex flex-col gap-2">{section.content()}</div>
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
