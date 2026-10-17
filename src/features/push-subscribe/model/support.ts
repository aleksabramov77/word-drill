/** Что мешает уведомлениям на этом устройстве. */
export type PushSupport =
  | "ok"
  /** iPhone/iPad: уведомления работают только у сайта, открытого с экрана «Домой». */
  | "install-first"
  | "unsupported";

export function isIos(userAgent: string, maxTouchPoints: number): boolean {
  // iPadOS притворяется Mac — выдаёт сенсорный экран.
  return (
    /iPhone|iPad|iPod/.test(userAgent) ||
    (/Macintosh/.test(userAgent) && maxTouchPoints > 1)
  );
}

export function detectPushSupport(): PushSupport {
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (isIos(navigator.userAgent, navigator.maxTouchPoints) && !standalone) {
    return "install-first";
  }
  if (
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    return "unsupported";
  }
  return "ok";
}

/** Публичный VAPID-ключ (base64url) → байты для pushManager.subscribe. */
export function vapidKeyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4))
    .replaceAll("-", "+")
    .replaceAll("_", "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}
