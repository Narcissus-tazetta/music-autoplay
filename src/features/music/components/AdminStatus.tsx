import { LogOut, ShieldCheck } from "lucide-react";
import { Badge } from "../../../shared/components/badge";
import { Button } from "../../../shared/components/button";
import { useAdminStore } from "../../../shared/stores/adminStore";

/**
 * 管理者権限状態の表示コンポーネント
 * 管理者ログイン時にのみ表示され、ログアウト機能も提供
 */
export const AdminStatus: React.FC = () => {
  const { isAdmin, logout } = useAdminStore();

  if (!isAdmin) return null;

  return (
    <div
      className="flex items-center gap-2 mb-4 p-3 border rounded-lg"
      style={{
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        borderColor: "rgba(59, 130, 246, 0.3)",
        color: "var(--color-fg, #212225)",
        transition:
          "var(--transition-colors, background-color 0.2s cubic-bezier(0.4,0,0.2,1), border-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1))",
      }}
    >
      <Badge
        variant="secondary"
        className="bg-blue-500 text-white hover:bg-blue-600"
      >
        <ShieldCheck size={14} className="mr-1" />
        管理者モード
      </Badge>
      <span className="text-sm text-muted-foreground">
        管理者権限でログインしています
      </span>
      <Button variant="outline" size="sm" onClick={logout} className="ml-auto">
        <LogOut size={14} className="mr-1" />
        ログアウト
      </Button>
    </div>
  );
};
