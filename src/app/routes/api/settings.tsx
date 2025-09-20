import { type LoaderFunctionArgs } from "react-router";
import { loginSession } from "../../sessions.server";
import { defaultSettingsStore } from "@/server/settingsPersistence";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const cookie = request.headers.get("Cookie") || "";
  const sess = await loginSession.getSession(cookie);
  const user = sess.get("user");
  if (!user || !user.id) return new Response(null, { status: 204 });
  const stored = defaultSettingsStore.load(user.id);
  return new Response(JSON.stringify(stored ? stored.value : {}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const action = async ({ request }: LoaderFunctionArgs) => {
  const cookie = request.headers.get("Cookie") || "";
  const sess = await loginSession.getSession(cookie);
  const user = sess.get("user");

  if (!user || !user.id) return new Response(null, { status: 401 });

  const data = (await request.json()) as unknown;
  if (!data || typeof data !== "object")
    return new Response(null, { status: 400 });

  defaultSettingsStore.save(user.id, data as Record<string, unknown>);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export default function Route() {
  return null;
}
