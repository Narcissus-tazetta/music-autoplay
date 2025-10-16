import logger from "@/server/logger";
import type { HandlerError } from "./errors";
import type { Result } from "./result";

type JsonResponse = {
  success: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export function respondWithResult<T>(
  r: Result<T, HandlerError>,
  okStatus = 200,
): Response {
  if (r.ok) {
    const body: JsonResponse = { success: true, data: r.value };
    return new Response(JSON.stringify(body), {
      status: okStatus,
      headers: { "Content-Type": "application/json" },
    });
  }
  const he = r.error;
  const message = he.message || "Internal error";
  const code = he.code ?? "internal_error";
  const errBody = (codeStr: string, msg: string, details?: unknown) =>
    ({
      success: false,
      error: { code: codeStr, message: msg, details },
    }) as JsonResponse;

  if (code === "validation" || code === "bad_request" || code === "422") {
    return new Response(
      JSON.stringify(errBody("bad_request", message, he.meta)),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (code === "unauthorized" || code === "401") {
    return new Response(JSON.stringify(errBody("unauthorized", message)), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (code === "forbidden" || code === "403") {
    return new Response(JSON.stringify(errBody("forbidden", message)), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (code === "not_found" || code === "404") {
    return new Response(JSON.stringify(errBody("not_found", message)), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  logger.warn("respondWithResult mapping to 500", { error: he });
  return new Response(JSON.stringify(errBody("internal_error", message)), {
    status: 500,
    headers: { "Content-Type": "application/json" },
  });
}

export function respondJsonOk(data: unknown) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
