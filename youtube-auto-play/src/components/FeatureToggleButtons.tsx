import type { FC } from 'react';
import { memo } from 'react';
import type { ExtensionMode } from '../types';
import { ExtensionModeToggle } from './ExtensionModeToggle';

interface Props {
    extensionMode: ExtensionMode;
    onCycleMode: () => void;
    onRevealMode: () => void;
    showExtensionToggle?: boolean;
}

export const FeatureToggleButtons: FC<Props> = memo(
    ({ extensionMode, onCycleMode, onRevealMode, showExtensionToggle }) => {
        const isExtensionToggleVisible = showExtensionToggle ?? true;

        return (
            <div className='flex flex-col gap-2 mb-4'>
                <div className={isExtensionToggleVisible ? '' : 'invisible'}>
                    <ExtensionModeToggle
                        extensionMode={extensionMode}
                        onCycleMode={onCycleMode}
                        onRevealMode={onRevealMode}
                    />
                </div>
            </div>
        );
    },
);

FeatureToggleButtons.displayName = 'FeatureToggleButtons';
