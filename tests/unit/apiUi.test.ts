import { describe, expect, test } from "vitest";
import { parseApiErrorForUI } from "../../src/shared/utils/apiUi";

describe("parseApiErrorForUI", () => {
  test("maps unauthorized codes", () => {
    const r = parseApiErrorForUI({
      code: "unauthorized",
      message: "ログインしてください",
    });
    expect(r.kind).toBe("unauthorized");
    expect(r.message).toBe("ログインしてください");
  });

  test("extracts field errors for validation", () => {
    const r = parseApiErrorForUI({
      code: "validation",
      message: "入力エラー",
      details: { url: "無効なURLです", other: 123 },
    });
    expect(r.kind).toBe("validation");
    // narrow to access fieldErrors safely
    if (r.kind === "validation") {
      const fe = (r as unknown as { fieldErrors?: Record<string, unknown> })
        .fieldErrors;
      expect(fe).toBeDefined();
      expect(fe?.url).toBe("無効なURLです");
      expect(fe?.other).toBeUndefined();
    } else {
      throw new Error("expected validation kind");
    }
  });

  test("falls back to internal for unknown codes", () => {
    const r = parseApiErrorForUI({
      code: "SOME_UNKNOWN_CODE",
      message: "エラー",
    });
    expect(r.kind).toBe("internal");
  });
});
