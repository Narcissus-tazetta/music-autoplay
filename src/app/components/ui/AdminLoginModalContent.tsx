import type { SessionRole } from '@/shared/stores/adminStore';
import { useAdminStore } from '@/shared/stores/adminStore';
import { Alert } from '@shadcn/ui/alert';
import { Badge } from '@shadcn/ui/badge';
import { Button } from '@shadcn/ui/button';
import { Input } from '@shadcn/ui/input';
import { Key, Loader, ShieldCheck, User, Waypoints } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AdminLoginModalContentProps {
    onClose?: () => void;
}

const ROLE_LABELS: Record<SessionRole, string> = {
    admin: '管理者',
    pathfinder: 'Pathfinder',
};

const ROLE_DESCRIPTIONS: Record<SessionRole, string> = {
    admin: '管理者削除とリクエスター詳細のログ確認を利用できます。',
    pathfinder: 'リクエスト時の挿入位置指定、自分の曲の並び替え、リクエスター詳細のログ確認を利用できます。',
};

const ROLE_ICONS: Record<SessionRole, typeof ShieldCheck> = {
    admin: ShieldCheck,
    pathfinder: Waypoints,
};

export function AdminLoginModalContent({ onClose }: AdminLoginModalContentProps) {
    const { roles, setRoles, logout } = useAdminStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isLoggedIn = roles.length > 0;

    useEffect(() => {
        const checkAdminStatus = async () => {
            try {
                const response = await fetch('/api/admin/status', {
                    credentials: 'include',
                });
                if (response.ok) {
                    const data = await response.json();
                    setRoles(Array.isArray(data.roles) ? data.roles : []);
                }
            } catch {
                // Silently fail
            }
        };

        checkAdminStatus();
    }, [setRoles]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        const wasLoggedIn = isLoggedIn;

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                setRoles(Array.isArray(data.roles) ? data.roles : []);
                setUsername('');
                setPassword('');
                // A first login closes the dialog like before this feature existed; adding a
                // second role keeps it open so the user can see the role was added.
                if (!wasLoggedIn) onClose?.();
            } else {
                // Limit error message length to prevent UI overflow (React handles XSS protection automatically)
                const safeError = typeof data.error === 'string' ? data.error.slice(0, 200) : 'ログインに失敗しました';
                setError(safeError);
            }
        } catch {
            setError('ネットワークエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async (role: SessionRole) => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({ role }),
            });

            if (response.ok) {
                const data = await response.json();
                const remainingRoles = Array.isArray(data.roles) ? data.roles : [];
                setRoles(remainingRoles);
                if (remainingRoles.length === 0) {
                    logout();
                    onClose?.();
                }
            } else {
                setError('ログアウトに失敗しました');
            }
        } catch {
            setError('ネットワークエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className='flex flex-col gap-4'>
            {isLoggedIn && (
                <>
                    <div className='flex flex-col gap-2'>
                        <div className='flex flex-wrap items-center gap-2'>
                            <h2 className='text-lg sm:text-xl font-bold tracking-tight'>ログイン中</h2>
                            {roles.map(r => {
                                const RoleIcon = ROLE_ICONS[r];
                                return (
                                    <Badge key={r} variant='secondary' className='gap-1'>
                                        <RoleIcon className='h-3.5 w-3.5' />
                                        {ROLE_LABELS[r]}
                                    </Badge>
                                );
                            })}
                        </div>
                        <p className='text-muted-foreground text-sm'>
                            複数のロールを併用できます。別のロールのアカウントでログインすると追加されます。
                        </p>
                    </div>

                    <div className='flex flex-col gap-2'>
                        {roles.map(r => {
                            const RoleIcon = ROLE_ICONS[r];
                            return (
                                <div
                                    key={r}
                                    className='flex items-center gap-3 rounded-xl border border-border/40 bg-muted/20 p-3'
                                >
                                    <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-background/60'>
                                        <RoleIcon className='h-5 w-5 text-blue-500 dark:text-blue-400' />
                                    </div>
                                    <div className='min-w-0 flex-1'>
                                        <p className='text-sm font-semibold'>{ROLE_LABELS[r]} mode</p>
                                        <p className='text-xs text-muted-foreground'>{ROLE_DESCRIPTIONS[r]}</p>
                                    </div>
                                    <Button
                                        type='button'
                                        onClick={() => handleLogout(r)}
                                        disabled={isLoading}
                                        variant='ghost'
                                        size='sm'
                                        className='shrink-0 text-destructive hover:text-destructive'
                                    >
                                        ログアウト
                                    </Button>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {error && (
                <Alert variant='destructive'>
                    <Alert.Description>{error}</Alert.Description>
                </Alert>
            )}

            <form onSubmit={handleLogin} className='flex flex-col gap-3'>
                <div className='flex flex-col gap-1'>
                    <h3 className='text-sm font-semibold'>
                        {isLoggedIn ? '別のロールを追加' : '管理者ログイン'}
                    </h3>
                    {!isLoggedIn && (
                        <p className='text-muted-foreground text-sm'>
                            管理者アカウントでログインしてください
                        </p>
                    )}
                </div>

                <div className='flex flex-col gap-2'>
                    <label htmlFor='username' className='text-sm font-medium'>
                        ユーザー名
                    </label>
                    <Input
                        id='username'
                        type='text'
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder='ユーザー名を入力'
                        required
                        disabled={isLoading}
                        leftIcon={<User className='h-4 w-4 opacity-80' />}
                        className='h-10 sm:h-11 rounded-xl text-sm sm:text-base'
                    />
                </div>

                <div className='flex flex-col gap-2'>
                    <label htmlFor='password' className='text-sm font-medium'>
                        パスワード
                    </label>
                    <Input
                        id='password'
                        type='password'
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder='パスワードを入力'
                        required
                        disabled={isLoading}
                        leftIcon={<Key className='h-4 w-4 opacity-80' />}
                        className='h-10 sm:h-11 rounded-xl text-sm sm:text-base'
                    />
                </div>

                <Button
                    type='submit'
                    disabled={isLoading}
                    className='h-10 sm:h-11 rounded-xl text-sm sm:text-base'
                >
                    {isLoading
                        ? (
                            <>
                                <Loader className='animate-spin h-4 w-4' />
                                <span className='sr-only'>ログイン処理中...</span>
                            </>
                        )
                        : (isLoggedIn ? 'ロールを追加' : 'ログイン')}
                </Button>
            </form>

            {onClose && (
                <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
                    <Button
                        type='button'
                        onClick={onClose}
                        disabled={isLoading}
                        variant='outline'
                        className='h-10 rounded-xl text-sm'
                    >
                        閉じる
                    </Button>
                </div>
            )}
        </div>
    );
}
