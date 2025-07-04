import { Toaster as Sonner } from 'sonner';
import type { ToasterProps } from 'sonner';
import { useColorModeStore } from '../../features/settings/stores/colorModeStore';

const Toaster = ({ ...props }: ToasterProps) => {
    const mode = useColorModeStore(s => s.mode);

    return (
        <Sonner
            theme={mode as ToasterProps['theme']}
            className='toaster group'
            style={{
                '--normal-bg': 'var(--popover)',
                '--normal-text': 'var(--popover-foreground)',
                '--normal-border': 'var(--border)',
            } as React.CSSProperties}
            {...props}
        />
    );
};

export { Toaster };
