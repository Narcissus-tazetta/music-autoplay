import { useSettingsSync } from '@/app/hooks/useSettingsSync';
import { Label } from '@shadcn/ui/label';
import { ToggleGroup } from '@shadcn/ui/toggle-group';
import { Eye, EyeOff, List, MoonIcon, Play, SparklesIcon, SunIcon } from 'lucide-react';
import { type FC, memo } from 'react';
import { type Theme, useTheme } from 'remix-themes';

const SettingsInner: FC = () => {
    const [theme, setTheme, meta] = useTheme();
    const { ytStatusVisible, setYtStatusVisible, ytStatusMode, setYtStatusMode } = useSettingsSync();

    return (
        <div className='flex flex-col gap-4 p-3 sm:p-4'>
            <Label className='flex items-center gap-2 text-sm sm:text-base bg-[repeating-linear-gradient(315deg,var(--pattern-fg)_0,var(--pattern-fg)_1px,transparent_0,transparent_50%)]'>
                テーマ
            </Label>
            <ToggleGroup
                type='single'
                variant='outline'
                unselectable='off'
                value={meta.definedBy === 'USER' ? (theme ?? 'system') : 'system'}
                onValueChange={value => {
                    if (value === undefined) return;
                    // oxlint-disable-next-line no-null
                    setTheme(value === 'system' ? null : (value as Theme));
                }}
                className='w-full'
            >
                <ToggleGroup.Item
                    value='light'
                    className='w-full h-11 sm:h-10 touch-target'
                >
                    <SunIcon className='h-5 w-5 sm:h-4 sm:w-4' />
                </ToggleGroup.Item>
                <ToggleGroup.Item
                    value='system'
                    className='w-full h-11 sm:h-10 touch-target'
                >
                    <SparklesIcon className='h-5 w-5 sm:h-4 sm:w-4' />
                </ToggleGroup.Item>
                <ToggleGroup.Item
                    value='dark'
                    className='w-full h-11 sm:h-10 touch-target'
                >
                    <MoonIcon className='h-5 w-5 sm:h-4 sm:w-4' />
                </ToggleGroup.Item>
            </ToggleGroup>

            <div className='h-2' />
            <Label className='flex items-center gap-2 text-sm sm:text-base bg-[repeating-linear-gradient(315deg,var(--pattern-fg)_0,var(--pattern-fg)_1px,transparent_0,transparent_50%)]'>
                YouTube status
            </Label>

            <ToggleGroup
                type='single'
                variant='outline'
                unselectable='off'
                value={ytStatusMode}
                onValueChange={value => {
                    if (value === undefined) return;
                    setYtStatusMode(value as 'compact' | 'player');
                }}
                className='w-full'
            >
                <ToggleGroup.Item
                    value='compact'
                    className='w-full h-11 sm:h-10 flex items-center justify-center gap-2 touch-target'
                >
                    <List className='w-5 h-5 sm:w-4 sm:h-4' />
                    <span className='text-sm sm:text-base'>コンパクト</span>
                </ToggleGroup.Item>
                <ToggleGroup.Item
                    value='player'
                    className='w-full h-11 sm:h-10 flex items-center justify-center gap-2 touch-target'
                >
                    <Play className='w-5 h-5 sm:w-4 sm:h-4' />
                    <span className='text-sm sm:text-base'>プレイヤー</span>
                </ToggleGroup.Item>
            </ToggleGroup>

            <ToggleGroup
                type='single'
                variant='outline'
                unselectable='off'
                value={ytStatusVisible ? 'on' : 'off'}
                onValueChange={value => {
                    if (value === undefined) return;
                    setYtStatusVisible(value === 'on');
                }}
                className='w-full'
            >
                <ToggleGroup.Item
                    value='on'
                    className='w-full h-11 sm:h-10 flex items-center justify-center gap-2 touch-target'
                >
                    <Eye className='w-5 h-5 sm:w-4 sm:h-4' />
                    <span className='text-sm sm:text-base'>表示</span>
                </ToggleGroup.Item>
                <ToggleGroup.Item
                    value='off'
                    className='w-full h-11 sm:h-10 flex items-center justify-center gap-2 touch-target'
                >
                    <EyeOff className='w-5 h-5 sm:w-4 sm:h-4' />
                    <span className='text-sm sm:text-base'>非表示</span>
                </ToggleGroup.Item>
            </ToggleGroup>
        </div>
    );
};

export const Settings = memo(SettingsInner);
