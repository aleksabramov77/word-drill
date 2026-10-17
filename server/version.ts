import pkg from "../package.json" with { type: "json" };

/** Версия сервера — та же, что у клиента (package.json); отдаётся в /api/health. */
export const APP_VERSION: string = pkg.version;
