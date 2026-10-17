import type { z } from "zod";
import { APP_VERSION } from "@/shared/config";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(`API ${status}: ${code}`);
  }
}

interface RequestOptions<T> {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  schema?: z.ZodType<T>;
}

/** Запрос к своему API (/api/...); ответ проверяется Zod-схемой. */
export async function apiFetch<T = void>(
  path: string,
  { method = "GET", body, schema }: RequestOptions<T> = {},
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      // Версия приложения: сервер не зовёт обновляться тех, у кого уже новая.
      "X-App-Version": APP_VERSION,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new ApiError(
      res.status,
      typeof error?.error === "string" ? error.error : res.statusText,
    );
  }
  if (!schema) return undefined as T;
  return schema.parse(await res.json());
}
