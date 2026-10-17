// Номер версии и время сборки клиента — из vite.config.ts (package.json → VITE_APP_VERSION).
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION ?? "dev";
export const BUILD_TIME: string | undefined = import.meta.env.VITE_BUILD_TIME;
