// Ключи VAPID для Web Push: `pnpm vapid` → строки для .env.local или /etc/words/app.env.
// Ключи создаются один раз: со сменой ключей все подписки на уведомления перестают работать.
import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
