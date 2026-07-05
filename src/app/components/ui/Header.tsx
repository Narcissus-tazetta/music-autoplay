import { useAuth } from '@/app/hooks/useAuth';
import { useAdminStore } from '@/shared/stores/adminStore';
import { useHomeViewStore } from '@/shared/stores/homeViewStore';
import { Alert } from '@shadcn/ui/alert';
import { Button } from '@shadcn/ui/button';
import { Dialog } from '@shadcn/ui/dialog';
import { Input } from '@shadcn/ui/input';
import { Sheet } from '@shadcn/ui/sheet';
import { Crown, HelpCircle, KeyRoundIcon, Loader, Pencil, SlidersHorizontalIcon } from 'lucide-react';
import { memo, useEffect, useState } from 'react';
import { Form, Link, useFetcher, useLocation } from 'react-router';
import { AdminLoginModalContent } from '~/components/ui/AdminLoginModalContent';
import { Settings } from '~/components/ui/Settings';
import { DropdownMenu } from '~/components/ui/shadcn/dropdown-menu';
import AdminStatus from './AdminStatus';

const developers = [
    {
        github: 'https://github.com/narcissus-tazetta',
        name: 'Narcissus-tazetta',
        slack: 'https://n-highschool.slack.com/team/U04VDPX7ZHV',
    },
    {
        github: 'https://github.com/alinco8',
        name: 'Alinco8',
        slack: 'https://n-highschool.slack.com/team/U06RE8R54JV',
    },
];

export interface HeaderProps {
    requesterHash?: string;
    requesterName?: string;
    userName?: string;
}

const HeaderInner = ({ requesterHash, requesterName, userName }: HeaderProps) => {
    const { showLogout, handleLogout } = useAuth(userName);
    const { isAdmin } = useAdminStore();
    const resetToRequests = useHomeViewStore(state => state.resetToRequests);
    const location = useLocation();
    const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
    const LAST_INDEX_OFFSET = 1;

    return (
        <div className='flex items-center justify-between w-full p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 transition-[border-color] duration-500'>
            <Link
                className='text-xl sm:text-2xl font-bold font-[Dancing_Script] pl-2 sm:pl-4 truncate'
                to='/'
                onClick={() => {
                    if (location.pathname === '/') resetToRequests();
                }}
            >
                Music Autoplay
            </Link>
            <div className='flex items-center gap-1 sm:gap-2'>
                {!isAdmin && (
                    <div className='hidden sm:block'>
                        <AdminStatus />
                    </div>
                )}
                <div className='hidden sm:block'>
                    <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
                        <Dialog.Trigger asChild>
                            <Button variant='ghost' size='icon' className='h-9 w-9 sm:h-10 sm:w-10'>
                                {isAdmin
                                    ? <Crown className='h-4 w-4 sm:h-5 sm:w-5 text-blue-500 dark:text-blue-400' />
                                    : <KeyRoundIcon className='h-4 w-4 sm:h-5 sm:w-5' />}
                            </Button>
                        </Dialog.Trigger>
                        <Dialog.Content>
                            <AdminLoginModalContent onClose={() => setIsAdminDialogOpen(false)} />
                        </Dialog.Content>
                    </Dialog>
                </div>
                {(() => {
                    if (showLogout) {
                        return (
                            <div className='flex items-center gap-1 sm:gap-2'>
                                {userName && (
                                    <span className='hidden md:inline text-sm text-gray-600 dark:text-gray-300 max-w-32 lg:max-w-none truncate'>
                                        {userName} でログイン中
                                    </span>
                                )}
                                <Form action='/auth/logout' method='post'>
                                    <Button
                                        type='submit'
                                        variant='outline'
                                        size='sm'
                                        className='text-xs sm:text-sm transition-opacity hover:opacity-80'
                                        onClick={handleLogout}
                                    >
                                        <span className='hidden sm:inline'>ログアウト</span>
                                        <span className='sm:hidden'>OUT</span>
                                    </Button>
                                </Form>
                            </div>
                        );
                    }
                    return (
                        <Form action='/auth/login' method='post'>
                            <Button type='submit' variant='outline' size='sm' className='text-xs sm:text-sm'>
                                <span className='hidden sm:inline'>Googleでログイン</span>
                                <span className='sm:hidden'>LOGIN</span>
                            </Button>
                        </Form>
                    );
                })()}
                <HeaderDisplayNameEditor requesterHash={requesterHash} requesterName={requesterName} />
                <Sheet>
                    <Sheet.Trigger asChild>
                        <Button variant='outline' size='icon' className='h-9 w-9 sm:h-10 sm:w-10'>
                            <SlidersHorizontalIcon className='h-4 w-4 sm:h-5 sm:w-5' />
                        </Button>
                    </Sheet.Trigger>
                    <Sheet.Content side='right' className='w-full sm:w-80 sm:max-w-md'>
                        <Sheet.Header>
                            <Sheet.Title className='text-lg sm:text-xl'>設定</Sheet.Title>
                            <Sheet.Description className='text-sm'>
                                ここでは、アプリケーションの動作や外観をカスタマイズできます。
                            </Sheet.Description>
                        </Sheet.Header>
                        {!isAdmin && (
                            <div className='block sm:hidden mt-4'>
                                <AdminStatus />
                            </div>
                        )}
                        <Settings />
                        <Sheet.Footer className='flex-col gap-2'>
                            <div className='flex items-center gap-2'>
                                <HelpCircle className='h-3 w-4 text-white' />
                                <a
                                    className='text-xs text-blue-500 dark:text-purple-400 hover:underline'
                                    href='https://narcissus-tazetta.github.io/music-autoplay-instruction-manual/'
                                    target='_blank'
                                    rel='noopener noreferrer'
                                >
                                    使い方・ヘルプ
                                </a>
                            </div>
                            <span className='text-xs'>
                                © 2026 {developers.map((dev, index) => (
                                    <span key={dev.name}>
                                        <DropdownMenu>
                                            <DropdownMenu.Trigger className='text-blue-500 dark:text-purple-400 hover:underline'>
                                                {dev.name}
                                            </DropdownMenu.Trigger>
                                            <DropdownMenu.Content>
                                                <DropdownMenu.Group>
                                                    <DropdownMenu.Item>
                                                        <a href={dev.slack} target='_blank' rel='noopener noreferrer'>
                                                            Slack
                                                        </a>
                                                    </DropdownMenu.Item>
                                                    <DropdownMenu.Item>
                                                        <a href={dev.github} target='_blank' rel='noopener noreferrer'>
                                                            GitHub
                                                        </a>
                                                    </DropdownMenu.Item>
                                                </DropdownMenu.Group>
                                            </DropdownMenu.Content>
                                        </DropdownMenu>
                                        {index < developers.length - LAST_INDEX_OFFSET && ', '}
                                    </span>
                                ))}
                            </span>
                        </Sheet.Footer>
                    </Sheet.Content>
                </Sheet>
            </div>
        </div>
    );
};

function displayRequesterName(requesterName?: string, requesterHash?: string): string {
    const normalized = requesterName?.trim();
    if (normalized && normalized !== 'guest') return normalized;
    if (requesterHash) return `${requesterHash.slice(0, 8)}...`;
    return '--------...';
}

function HeaderDisplayNameEditor({ requesterHash, requesterName }: { requesterHash?: string; requesterName?: string }) {
    const displayName = displayRequesterName(requesterName, requesterHash);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [draftName, setDraftName] = useState(displayName);
    const displayNameFetcher = useFetcher<{
        error?: string;
        ok?: boolean;
        requesterName?: string;
    }>();
    const savedName = displayRequesterName(displayNameFetcher.data?.requesterName ?? requesterName, requesterHash);

    useEffect(() => {
        setDraftName(displayName);
    }, [displayName]);

    useEffect(() => {
        if (!displayNameFetcher.data?.ok || !displayNameFetcher.data.requesterName) return;
        const nextName = displayRequesterName(displayNameFetcher.data.requesterName, requesterHash);
        setDraftName(nextName);
        setIsDialogOpen(false);
    }, [displayNameFetcher.data]);

    return (
        <>
            <div className='hidden md:flex items-center gap-1 rounded-lg border border-border/40 bg-muted/20 px-2 py-1'>
                <span className='max-w-32 truncate text-xs text-muted-foreground'>表示名</span>
                <span className='max-w-36 truncate text-sm font-semibold'>{savedName}</span>
                <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    className='h-7 w-7 text-muted-foreground hover:text-foreground'
                    onClick={() => {
                        setDraftName(savedName);
                        setIsDialogOpen(true);
                    }}
                    aria-label='表示名を編集'
                >
                    <Pencil className='h-3.5 w-3.5' />
                </Button>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <Dialog.Content>
                    <div className='flex flex-col gap-4'>
                        <div className='flex flex-col gap-2'>
                            <Dialog.Title className='text-lg sm:text-xl font-bold tracking-tight'>
                                表示名を編集
                            </Dialog.Title>
                            <Dialog.Description className='text-muted-foreground text-sm'>
                                次のリクエストからこの表示名で表示されます。
                            </Dialog.Description>
                        </div>
                        {displayNameFetcher.data?.error && (
                            <Alert variant='destructive'>
                                <Alert.Description>{displayNameFetcher.data.error}</Alert.Description>
                            </Alert>
                        )}
                        <displayNameFetcher.Form
                            method='post'
                            action='/api/requester/name'
                            className='flex flex-col gap-3'
                        >
                            <div className='flex flex-col gap-2'>
                                <label htmlFor='requesterName' className='text-sm font-medium'>
                                    表示名
                                </label>
                                <Input
                                    id='requesterName'
                                    name='requesterName'
                                    value={draftName}
                                    maxLength={24}
                                    onChange={event => setDraftName(event.currentTarget.value)}
                                    autoComplete='nickname'
                                    placeholder='表示名を入力'
                                    className='h-10 sm:h-11 rounded-xl text-sm sm:text-base'
                                    autoFocus
                                />
                                <p className='text-xs text-muted-foreground'>
                                    未設定時は匿名ID（{displayRequesterName(undefined, requesterHash)}）が表示されます。
                                </p>
                            </div>
                            <Button
                                type='submit'
                                disabled={displayNameFetcher.state !== 'idle'}
                                variant='outline'
                                size='lg'
                                className='h-10 sm:h-11 rounded-xl text-sm sm:text-base'
                            >
                                {displayNameFetcher.state !== 'idle'
                                    ? (
                                        <>
                                            <Loader className='animate-spin h-4 w-4' />
                                            <span className='sr-only'>保存中...</span>
                                        </>
                                    )
                                    : (
                                        '保存'
                                    )}
                            </Button>
                        </displayNameFetcher.Form>
                    </div>
                </Dialog.Content>
            </Dialog>
        </>
    );
}

export const Header = memo(HeaderInner);
