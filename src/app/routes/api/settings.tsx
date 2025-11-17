import { defaultSettingsStore } from "@/server/settingsPersistence";
import { safeExecuteAsync } from "@/shared/utils/errors";
import { err as makeErr } from "@/shared/utils/errors/result-handlers";
import { respondWithResult } from "@/shared/utils/httpResponse";
import { type LoaderFunctionArgs } from "react-router";
import z from "zod";
import { loginSession } from "../../sessions.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const res = await safeExecuteAsync(async () => {
    const cookie = request.headers.get("Cookie") || "";
    const sess = await loginSession.getSession(cookie);
    const user = sess.get("user");
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (user === undefined || user === null || !user.id)
      return { __status: 204 } as { __status: number };
    const stored = defaultSettingsStore.load(user.id);
    return stored ? stored.value : {};
  });

  if (!res.ok)
    return respondWithResult(
      makeErr({ message: Object.prototype.toString.call(res.error) }),
    );
  const maybeStatus = res.value as unknown;
  if (
    maybeStatus &&
    typeof maybeStatus === "object" &&
    typeof (maybeStatus as { __status?: unknown }).__status === "number" &&
    (maybeStatus as { __status?: number }).__status === 204
  ) {
    return new Response(null, { status: 204 });
  }
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- res.value may be undefined
  return new Response(JSON.stringify(res.value ?? {}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const action = async ({ request }: LoaderFunctionArgs) => {
  const res = await safeExecuteAsync(async () => {
    const cookie = request.headers.get("Cookie") || "";
    const sess = await loginSession.getSession(cookie);
    const user = sess.get("user");

    if (!user || typeof user.id !== "string")
      return { __status: 401 } as { __status: number };

    const data = (await request.json()) as unknown;
    if (data == null || typeof data !== "object")
      return { __status: 400 } as { __status: number };

    const SettingsSchema = z
      .object({ ytStatusVisible: z.boolean().optional() })
      .passthrough();
    const parsed = SettingsSchema.safeParse(data);
    if (!parsed.success) return { __status: 400 } as { __status: number };

    // persist validated settings (passthrough allows extra keys but ensures known keys are typed)
    defaultSettingsStore.save(user.id, parsed.data as Record<string, unknown>);
    return { ok: true };
  });

  if (!res.ok) {
    const errVal = res.error;
    let msg = "Unknown error";
    if (typeof errVal === "string") msg = errVal;
    else if (
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      errVal &&
      typeof errVal === "object" &&
      "message" in (errVal as Record<string, unknown>)
    ) {
      const m = (errVal as Record<string, unknown>).message;
      if (typeof m === "string") msg = m;
    } else {
      try {
        msg = JSON.stringify(errVal);
      } catch {
        msg = Object.prototype.toString.call(errVal);
      }
    }
    return respondWithResult(makeErr({ message: msg }));
  }

  const maybeStatus = res.value as unknown;
  if (
    maybeStatus &&
    typeof maybeStatus === "object" &&
    typeof (maybeStatus as { __status?: unknown }).__status === "number"
  ) {
    const status = (maybeStatus as { __status: number }).__status;
    return new Response(null, { status });
  }

  return new Response(JSON.stringify(res.value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export default function Route() {
  return null; // このルートはアクション専用のため UI をレンダリングしません
}
