import { useEffect, useState } from 'react';

/**
 * 任意のキーでtrue/falseをトグルするカスタムフック
 * @param key キー文字（例: '^', '¥', '-' など）
 */
export function useGamingToggle(key: string) {
    const [gaming, setGaming] = useState(false);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.metaKey && e.shiftKey && e.key.toLowerCase() === key.toLowerCase()) setGaming(prev => !prev);
        };
        window.addEventListener('keydown', handler);
        return () => {
            window.removeEventListener('keydown', handler);
        };
    }, [key]);

    return gaming;
}
