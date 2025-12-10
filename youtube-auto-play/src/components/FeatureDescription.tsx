import type { FC } from 'react';
import { memo } from 'react';

export const FeatureDescription: FC = memo(() => (
    <div className='mt-3 p-4 bg-gradient-to-br from-blue-50 to-slate-50 border border-blue-100 rounded-lg text-sm text-slate-700'>
        <div className='mb-2'>
            <span className='font-bold text-blue-700'>Auto Tab:</span>{' '}
            有効にすると、動画終了時に自動で次のURLタブを開きます。
        </div>
        <div>
            <span className='font-bold text-green-700'>Deadline:</span>{' '}
            有効にすると、指定時間帯でYouTubeの自動再生を制限します。
        </div>
    </div>
));

FeatureDescription.displayName = 'FeatureDescription';
