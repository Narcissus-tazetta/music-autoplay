import type { FC } from 'react';
import { memo } from 'react';

interface Props {
    error: string | null;
}

export const ErrorDisplay: FC<Props> = memo(({ error }) => {
    if (!error) return null;

    return (
        <p
            id='error-text'
            className='text-sm text-red-600 font-medium bg-red-50 border border-red-200 p-2 rounded-lg mb-3'
        >
            {error}
        </p>
    );
});

ErrorDisplay.displayName = 'ErrorDisplay';
