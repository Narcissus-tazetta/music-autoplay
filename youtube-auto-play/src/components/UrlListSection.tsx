import { ExternalLink, List, Trash2 } from 'lucide-react';
import type { FC, KeyboardEvent } from 'react';
import { memo, useCallback } from 'react';
import { UI_TEXT } from '../constants';
import type { UrlItem } from '../types';

interface Props {
    urls: UrlItem[];
    onOpenFirstUrl: () => void;
    onOpenUrl: (url: string) => void;
    onRemoveUrl: (index: number) => void;
}

export const UrlListSection: FC<Props> = memo(
    ({ urls, onOpenFirstUrl, onOpenUrl, onRemoveUrl }) => {
        const handleKeyDown = useCallback(
            (e: KeyboardEvent, url: string) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenUrl(url);
                }
            },
            [onOpenUrl],
        );

        const handleDelete = useCallback(
            (e: React.MouseEvent, index: number) => {
                e.stopPropagation();
                onRemoveUrl(index);
            },
            [onRemoveUrl],
        );

        return (
            <div className='mb-4'>
                <div className='flex justify-center mb-3'>
                    <button
                        id='open-first-url'
                        onClick={onOpenFirstUrl}
                        disabled={urls.length === 0}
                        className={`px-5 h-12 rounded-lg font-semibold shadow-sm transition-all text-sm flex items-center gap-2 ${
                            urls.length === 0
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                    >
                        <ExternalLink size={18} />
                        {UI_TEXT.OPEN_URL_BUTTON}
                    </button>
                </div>
                <h2 className='text-base font-bold mb-2 text-slate-700 flex items-center gap-2'>
                    <List size={20} />
                    {UI_TEXT.URL_LIST_TITLE}
                </h2>
                <ul className='max-h-44 overflow-y-auto border border-blue-200 bg-white rounded-lg shadow-sm p-1'>
                    {urls.length === 0 ? <li className='p-3 text-sm text-gray-500'>{UI_TEXT.NO_URLS_MESSAGE}</li> : (
                        urls.map((u, i) => (
                            <li
                                key={i}
                                onClick={() => onOpenUrl(u.url)}
                                role='button'
                                tabIndex={0}
                                onKeyDown={e => handleKeyDown(e, u.url)}
                                className='flex items-start justify-between p-2 text-sm text-gray-800 border-b border-gray-100 cursor-pointer hover:bg-blue-50 rounded transition-colors'
                            >
                                <span className='break-words pr-3'>{u.title || u.url}</span>
                                <button
                                    aria-label={`delete-${i}`}
                                    onClick={e => handleDelete(e, i)}
                                    className='ml-3 w-8 h-8 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-sm transition-colors shrink-0'
                                >
                                    <Trash2 size={16} />
                                </button>
                            </li>
                        ))
                    )}
                </ul>
            </div>
        );
    },
);

UrlListSection.displayName = 'UrlListSection';
