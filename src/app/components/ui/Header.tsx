import { useAuth } from '@/app/hooks/useAuth';
import { Button } from '@shadcn/ui/button';
import { Sheet } from '@shadcn/ui/sheet';
import { SlidersHorizontalIcon } from 'lucide-react';
import { memo } from 'react';
import { Form, Link } from 'react-router';
import { Settings } from '~/components/ui/Settings';
import { DropdownMenu } from '~/components/ui/shadcn/dropdown-menu';
import AdminStatus from './AdminStatus';

const developers = [
    {
        github: 'https://github.com/narcissus-tazetta',
        name: 'Narcissus-tazetta',
        slack: 'https://n-highschool.slack.com/archives/D088N1A4WET',
    },
    {
        github: 'https://github.com/alinco8',
        name: 'Alinco8',
        slack: 'https://n-highschool.slack.com/archives/D06QV02HW30',
    },
];

export interface HeaderProps {
    userName?: string;
}

const HeaderInner = ({ userName }: HeaderProps) => {
    const { showLogout, handleLogout } = useAuth(userName);
    const LAST_INDEX_OFFSET = 1;

    return (
        <div className='flex items-center justify-between w-full p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 transition-[border-color] duration-500'>
            <Link
                className='text-xl sm:text-2xl font-bold font-[Dancing_Script] pl-2 sm:pl-4 truncate'
                to='/'
            >
                Music Autoplay
            </Link>
            <div className='flex items-center gap-1 sm:gap-2'>
                <div className='hidden sm:block'>
                    <AdminStatus />
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
                                        className='text-xs sm:text-sm'
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
                            <Button
                                type='submit'
                                variant='outline'
                                size='sm'
                                className='text-xs sm:text-sm'
                            >
                                <span className='hidden sm:inline'>Googleでログイン</span>
                                <span className='sm:hidden'>LOGIN</span>
                            </Button>
                        </Form>
                    );
                })()}
                <Sheet>
                    <Sheet.Trigger asChild>
                        <Button
                            variant='outline'
                            size='icon'
                            className='h-9 w-9 sm:h-10 sm:w-10'
                        >
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
                        <div className='block sm:hidden mt-4'>
                            <AdminStatus />
                        </div>
                        <Settings />
                        <Sheet.Footer className='flex-col gap-2'>
                            <span className='text-xs'>
                                © 2025 {developers.map((dev, index) => (
                                    <span key={dev.name}>
                                        <DropdownMenu>
                                            <DropdownMenu.Trigger className='text-blue-500 dark:text-purple-400 hover:underline'>
                                                {dev.name}
                                            </DropdownMenu.Trigger>
                                            <DropdownMenu.Content>
                                                <DropdownMenu.Group>
                                                    <DropdownMenu.Item>
                                                        <a
                                                            href={dev.slack}
                                                            target='_blank'
                                                            rel='noopener noreferrer'
                                                        >
                                                            Slack
                                                        </a>
                                                    </DropdownMenu.Item>
                                                    <DropdownMenu.Item>
                                                        <a
                                                            href={dev.github}
                                                            target='_blank'
                                                            rel='noopener noreferrer'
                                                        >
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

export const Header = memo(HeaderInner);
