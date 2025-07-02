import { useAdminStore } from "../../../shared/stores/adminStore";
import { Badge } from "../../../shared/components/badge";
import { Button } from "../../../shared/components/button";
import { ShieldCheck, LogOut } from "lucide-react";

interface AdminStatusProps {
  mode: "dark" | "light";
}

/**
 * 管理者権限状態の表示コンポーネント
 * 管理者ログイン時にのみ表示され、ログアウト機能も提供
 */
export const AdminStatus: React.FC<AdminStatusProps> = ({ mode }) => {
  const { isAdmin, logout } = useAdminStore();

  if (!isAdmin) return null;

  return (
    <div
      className="flex items-center gap-2 mb-4 p-3 border rounded-lg"
      style={{
        backgroundColor: mode === "dark" ? "rgba(59, 130, 246, 0.1)" : "rgba(59, 130, 246, 0.05)",
        borderColor: mode === "dark" ? "rgba(59, 130, 246, 0.3)" : "rgba(59, 130, 246, 0.2)",
      }}
    >
      <Badge variant="secondary" className="bg-blue-500 text-white hover:bg-blue-600">
        <ShieldCheck size={14} className="mr-1" />
        管理者モード
      </Badge>
      <span className="text-sm text-muted-foreground">管理者権限でログインしています</span>
      <Button variant="outline" size="sm" onClick={logout} className="ml-auto">
        <LogOut size={14} className="mr-1" />
        ログアウト
      </Button>
    </div>
  );
};
