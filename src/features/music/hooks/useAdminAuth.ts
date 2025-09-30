import { getSocket } from "@/app/lib/socketClient";
import { useCallback, useEffect } from "react";
import { useAdminStore } from "../../../shared/stores/adminStore";

interface AuthResult {
  success: boolean;
  error?: string;
}

const isAuthResult = (v: unknown): v is AuthResult => {
  if (typeof v !== "object" || v === null) return false;
  const rec = v as Record<string, unknown>;
  if (typeof rec.success !== "boolean") return false;
  if (rec.error !== undefined && typeof rec.error !== "string") return false;
  return true;
};

export const useAdminAuth = () => {
  const setIsAdmin = useCallback((v: boolean) => {
    useAdminStore.getState().setIsAdmin(v);
  }, []);

  const authenticateByQuery = useCallback(
    (adminParam: string) => {
      return new Promise<{ success: boolean; message?: string }>((resolve) => {
        getSocket().emit("adminAuthByQuery", adminParam, (result: unknown) => {
          if (isAuthResult(result) && result.success) {
            setIsAdmin(true);
            resolve({
              success: true,
              message: "URL経由で管理者認証に成功しました",
            });
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("admin");
            window.history.replaceState({}, "", `${newUrl}`);
          } else {
            const err =
              isAuthResult(result) && result.error ? result.error : undefined;
            console.warn("URL管理者認証に失敗:", err);
            resolve({ success: false, message: err });
          }
        });
      });
    },
    [setIsAdmin],
  );

  const authenticateByKey = useCallback(
    (key: string) => {
      return new Promise<{ success: boolean; message?: string }>((resolve) => {
        getSocket().emit("adminAuth", key, (result: unknown) => {
          if (isAuthResult(result) && result.success) {
            setIsAdmin(true);
            resolve({ success: true, message: "管理者認証に成功しました" });
          } else {
            const err =
              isAuthResult(result) && result.error
                ? result.error
                : "管理者認証に失敗しました";
            resolve({ success: false, message: err });
          }
        });
      });
    },
    [setIsAdmin],
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const adminParam = urlParams.get("admin");
      if (adminParam) void authenticateByQuery(adminParam);
    }
  }, [authenticateByQuery]);

  return {
    authenticateByQuery,
    authenticateByKey,
  };
};
