import { z } from "zod";

/**
 * Вход:
 * - google — OAuth Google, пускаем только почты из ALLOWED_EMAILS;
 * - dev — без Google (локально и в e2e): все запросы от одного пользователя. В проде запрещён.
 */
export type AuthConfig =
  | {
      mode: "google";
      clientId: string;
      clientSecret: string;
      /** Публичный адрес сайта: https://words.<ip>.sslip.io — из него строится redirect URI. */
      siteUrl: string;
      allowedEmails: ReadonlySet<string>;
      secureCookies: boolean;
    }
  | { mode: "dev"; email: string };

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  SITE_URL: z.url().optional(),
  ALLOWED_EMAILS: z.string().optional(),
  DEV_USER_EMAIL: z.email().optional(),
  /** Разрешить dev-вход в прод-сборке — только для e2e (playwright.config.ts). */
  ALLOW_DEV_AUTH: z.string().optional(),
});

export function parseEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,\s]+/)
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function readAuthConfig(env: NodeJS.ProcessEnv): AuthConfig {
  const parsed = envSchema.parse(env);
  const production = parsed.NODE_ENV === "production";
  if (!parsed.GOOGLE_CLIENT_ID) {
    if (production && parsed.ALLOW_DEV_AUTH !== "1") {
      throw new Error(
        "Нет GOOGLE_CLIENT_ID: в проде вход только через Google (см. README → Вход)",
      );
    }
    return { mode: "dev", email: parsed.DEV_USER_EMAIL ?? "local@localhost" };
  }
  const allowedEmails = parseEmails(parsed.ALLOWED_EMAILS);
  if (
    !parsed.GOOGLE_CLIENT_SECRET ||
    !parsed.SITE_URL ||
    allowedEmails.size === 0
  ) {
    throw new Error(
      "Для входа через Google нужны GOOGLE_CLIENT_SECRET, SITE_URL и ALLOWED_EMAILS",
    );
  }
  return {
    mode: "google",
    clientId: parsed.GOOGLE_CLIENT_ID,
    clientSecret: parsed.GOOGLE_CLIENT_SECRET,
    siteUrl: parsed.SITE_URL.replace(/\/$/, ""),
    allowedEmails,
    secureCookies: parsed.SITE_URL.startsWith("https://"),
  };
}
