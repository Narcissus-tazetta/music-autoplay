/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import { defaultSettingsStore } from "@/server/settingsPersistence";
import { safeExecuteAsync } from "@/shared/utils/handle";
import { respondWithResult } from "@/shared/utils/httpResponse";
import { err as makeErr } from "@/shared/utils/result";
import { type LoaderFunctionArgs } from "react-router";
import { loginSession } from "../../sessions.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const res = await safeExecuteAsync(async () => {
    const cookie = request.headers.get("Cookie") || "";
    const sess = await loginSession.getSession(cookie);
    const user = sess.get("user");
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

    if (!user || typeof user.id !== "string") {
      const e = new Error("unauthorized");
      (e as Error & { code?: string }).code = "unauthorized";
      throw e;
    }

    const data = (await request.json()) as unknown;
    if (data == null || typeof data !== "object") {
      const e = new Error("bad request");
      (e as Error & { code?: string }).code = "bad_request";
      throw e;
    }

    defaultSettingsStore.save(user.id, data as Record<string, unknown>);
    return { ok: true };
  });
  if (!res.ok) {
    const errVal = res.error;
    let msg = "Unknown error";
    if (typeof errVal === "string") msg = errVal;
    else if (
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
  return new Response(JSON.stringify(res.value), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export default function Route() {
  return null; // このルートはアクション専用のため UI をレンダリングしません
}
