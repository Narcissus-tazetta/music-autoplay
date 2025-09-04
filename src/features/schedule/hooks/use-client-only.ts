import { useEffect, useState } from "react";

/**
 * クライアントサイドでのみレンダリングを制御するフック
 * ハイドレーションエラーを防ぐために使用
 */
export function useClientOnly() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}
