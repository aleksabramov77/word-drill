import webpush from "web-push";

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  /** Куда перейти по нажатию. */
  url: string;
  /** Одинаковый тег — новое уведомление заменяет неотвеченное. */
  tag: string;
}

export type SendResult = { ok: true } | { ok: false; gone: boolean };

/** Отправка уведомления; в тестах подменяется. */
export interface PushSender {
  publicKey: string;
  send(target: PushTarget, payload: PushPayload): Promise<SendResult>;
}

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

export function readVapidConfig(env: NodeJS.ProcessEnv): VapidConfig | null {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: VAPID_PUBLIC_KEY,
    privateKey: VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT ?? env.SITE_URL ?? "https://localhost",
  };
}

const TTL_SECONDS = 60 * 60;

export function createWebPushSender(vapid: VapidConfig): PushSender {
  return {
    publicKey: vapid.publicKey,
    async send(target, payload) {
      try {
        await webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          JSON.stringify(payload),
          {
            TTL: TTL_SECONDS,
            urgency: "normal",
            vapidDetails: vapid,
          },
        );
        return { ok: true };
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410 — подписка больше не существует (удалили приложение, сбросили разрешение).
        return { ok: false, gone: status === 404 || status === 410 };
      }
    },
  };
}
