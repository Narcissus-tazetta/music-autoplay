import type { FC } from 'react';
import { memo } from 'react';
import { SHORTCUTS, UI_TEXT } from '../constants';

export const ShortcutInfo: FC = memo(() => (
    <div className='mt-3 p-4 bg-white border border-blue-100 rounded-lg shadow-sm text-sm text-slate-700'>
        <h3 className='font-bold mb-2.5 text-blue-700'>{UI_TEXT.SHORTCUTS_TITLE}</h3>
        <ul className='space-y-1.5'>
            {SHORTCUTS.map((shortcut, index) => (
                <li key={index} className='flex items-start'>
                    <span className='font-semibold text-blue-600 mr-2'>{shortcut.key}:</span>
                    <span>{shortcut.description}</span>
                </li>
            ))}
        </ul>
    </div>
));

ShortcutInfo.displayName = 'ShortcutInfo';
