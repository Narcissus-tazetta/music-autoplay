import { LogOut, ShieldCheck } from "lucide-react";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { useAdminStore } from "../../stores/adminStore";

/**
 * 管理者権限状態の表示コンポーネント
 */
export const AdminStatus: React.FC = () => {
    const { isAdmin, logout } = useAdminStore();

    if (!isAdmin) return null;

    return (
        <div className="flex items-center gap-2 mb-4 p-3 border rounded-lg bg-[rgba(59,130,246,0.08)] border-[rgba(59,130,246,0.25)] text-app-fg transition-colors">
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
