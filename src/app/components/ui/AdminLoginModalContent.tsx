import { useAdminStore } from '@/shared/stores/adminStore';
import { Alert } from '@shadcn/ui/alert';
import { Button } from '@shadcn/ui/button';
import { Input } from '@shadcn/ui/input';
import { Key, Loader, User } from 'lucide-react';
import { useEffect, useState } from 'react';

interface AdminLoginModalContentProps {
    onClose?: () => void;
}

export function AdminLoginModalContent({ onClose }: AdminLoginModalContentProps) {
    const { isAdmin, setIsAdmin, logout } = useAdminStore();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkAdminStatus = async () => {
            try {
                const response = await fetch('/api/admin/status', {
                    credentials: 'include',
                });
                if (response.ok) {
                    const data = await response.json();
                    setIsAdmin(data.isAdmin);
                }
            } catch {
                // Silently fail
            }
        };

        checkAdminStatus();
    }, [setIsAdmin]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

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
                setIsAdmin(true);
                setUsername('');
                setPassword('');
                onClose?.();
            } else {
                // Sanitize error message to prevent XSS
                const safeError = typeof data.error === 'string' ? data.error.slice(0, 200) : 'ログインに失敗しました';
                setError(safeError);
            }
        } catch {
            setError('ネットワークエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/admin/logout', {
                method: 'POST',
                credentials: 'include',
            });

            if (response.ok) {
                logout();
                onClose?.();
            } else {
                setError('ログアウトに失敗しました');
            }
        } catch {
            setError('ネットワークエラーが発生しました');
        } finally {
            setIsLoading(false);
        }
    };

    if (isAdmin) {
        return (
            <div className='flex flex-col gap-6'>
                <div className='flex flex-col gap-2'>
                    <h2 className='text-2xl font-bold'>管理者としてログイン中</h2>
                    <p className='text-muted-foreground text-sm'>
                        管理者権限でログインしています
                    </p>
                </div>

                {error && (
                    <Alert variant='destructive'>
                        <Alert.Description>{error}</Alert.Description>
                    </Alert>
                )}

                <Button
                    onClick={handleLogout}
                    disabled={isLoading}
                    variant='destructive'
                    size='lg'
                    className='h-12 text-base transition-opacity hover:opacity-80'
                >
                    {isLoading ? <Loader className='animate-spin h-4 w-4' /> : 'ログアウト'}
                </Button>
            </div>
        );
    }

    return (
        <div className='flex flex-col gap-6'>
            <div className='flex flex-col gap-2'>
                <h2 className='text-2xl font-bold'>管理者ログイン</h2>
                <p className='text-muted-foreground text-sm'>
                    管理者アカウントでログインしてください
                </p>
            </div>

            {error && (
                <Alert variant='destructive'>
                    <Alert.Description>{error}</Alert.Description>
                </Alert>
            )}

            <form onSubmit={handleLogin} className='flex flex-col gap-4'>
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
                        className='h-12 text-base'
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
                        className='h-12 text-base'
                    />
                </div>

                <Button
                    type='submit'
                    disabled={isLoading}
                    size='lg'
                    className='h-12 text-base'
                >
                    {isLoading ? <Loader className='animate-spin h-4 w-4' /> : 'ログイン'}
                </Button>
            </form>
        </div>
    );
}
