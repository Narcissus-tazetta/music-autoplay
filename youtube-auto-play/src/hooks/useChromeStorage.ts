import { useCallback, useEffect, useState } from 'react';
import type { ChromeStorageData } from '../types';
import { getChromeStorage, setChromeStorage } from '../utils/chrome';

export function useChromeStorage<K extends keyof ChromeStorageData>(
    key: K,
    defaultValue: ChromeStorageData[K],
): [ChromeStorageData[K], (value: ChromeStorageData[K]) => Promise<void>] {
    const [value, setValue] = useState<ChromeStorageData[K]>(defaultValue);

    useEffect(() => {
        let isMounted = true;

        getChromeStorage([key]).then(result => {
            if (isMounted && result[key] !== undefined) setValue(result[key]);
        });

        return () => {
            isMounted = false;
        };
    }, [key]);

    const updateValue = useCallback(
        async (newValue: ChromeStorageData[K]) => {
            setValue(newValue);
            await setChromeStorage({ [key]: newValue } as Partial<ChromeStorageData>);
        },
        [key],
    );

    return [value, updateValue];
}
export function useChromeStorageMulti<K extends keyof ChromeStorageData>(
    keys: K[],
): [Pick<ChromeStorageData, K>, boolean] {
    const [data, setData] = useState<Pick<ChromeStorageData, K>>({} as Pick<ChromeStorageData, K>);
    const [loading, setLoading] = useState(true);
    const keysString = keys.join(',');

    useEffect(() => {
        let isCancelled = false;

        const loadData = async () => {
            const result = await getChromeStorage(keys);
            if (!isCancelled) {
                setData(result);
                setLoading(false);
            }
        };

        loadData();

        return () => {
            isCancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keysString]);

    return [data, loading];
}
