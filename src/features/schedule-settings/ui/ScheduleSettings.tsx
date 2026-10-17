import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useSaveSettings, useSettings } from "../api/settingsApi.ts";
import { type ScheduleForm, scheduleFormSchema } from "../model/schema.ts";

const FIELDS: { name: keyof ScheduleForm; label: string }[] = [
  { name: "windowStart", label: "Присылать с (час)" },
  { name: "windowEnd", label: "до (час)" },
  { name: "minGapMinutes", label: "Не чаще, чем раз в (минут)" },
  { name: "dailyPushLimit", label: "Уведомлений в день, не больше" },
  { name: "newPerDay", label: "Новых слов в день, не больше" },
];

export function ScheduleSettings() {
  const { data: settings } = useSettings();
  const save = useSaveSettings();
  const form = useForm<ScheduleForm>({
    resolver: zodResolver(scheduleFormSchema),
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (settings) form.reset(settings);
  }, [settings, form]);

  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const submit = form.handleSubmit((values) =>
    save.mutate(
      { ...values, timeZone: deviceZone },
      {
        onSuccess: () => toast.success("Сохранено"),
        onError: () => toast.error("Не получилось сохранить"),
      },
    ),
  );

  if (!settings) return null;
  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map(({ name, label }) => (
          <div key={name} className="flex flex-col gap-1 text-sm">
            <label htmlFor={`schedule-${name}`}>{label}</label>
            <Input
              id={`schedule-${name}`}
              type="number"
              inputMode="numeric"
              {...form.register(name, { valueAsNumber: true })}
            />
            {errors[name] && (
              <span className="text-destructive text-xs">
                {errors[name]?.message ?? "Неверное значение"}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Часовой пояс: {settings.timeZone}
        {settings.timeZone !== deviceZone &&
          ` (на этом устройстве — ${deviceZone}, сохранится он)`}
        . Без ответа пауза между уведомлениями удваивается, до 4 часов.
      </p>
      <Button type="submit" className="self-start" disabled={save.isPending}>
        Сохранить
      </Button>
    </form>
  );
}
