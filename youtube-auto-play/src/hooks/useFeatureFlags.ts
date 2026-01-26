import { useCallback, useEffect, useState } from 'react';
import type { ExtensionFeatureFlags } from '../types';
import { getExtensionFeatureFlags, setExtensionFeatureFlags } from '../utils/chrome';

type Flags = Required<ExtensionFeatureFlags>;

interface UseFeatureFlagsReturn {
    flags: Flags;
    loading: boolean;
    error: string | null;
    setFlag: (key: keyof Flags, value: boolean) => Promise<void>;
    patchFlags: (patch: Partial<Flags>) => Promise<void>;
    refresh: () => Promise<void>;
}

export function useFeatureFlags(): UseFeatureFlagsReturn {
    const [flags, setFlags] = useState<Flags>({
        brokerShadow: false,
        brokerActive: false,
        eventDrivenOffscreen: false,
        strictContentTimers: false,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const next = await getExtensionFeatureFlags();
            setFlags(next);
        } catch (err) {
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    const setFlag = useCallback(async (key: keyof Flags, value: boolean) => {
        setError(null);
        const prev = flags;
        const optimistic = { ...prev, [key]: value };
        setFlags(optimistic);

        try {
            const next = await setExtensionFeatureFlags({ [key]: value });
            setFlags(next);
        } catch (err) {
            setFlags(prev);
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [flags]);

    const patchFlags = useCallback(async (patch: Partial<Flags>) => {
        setError(null);
        const prev = flags;
        const optimistic = { ...prev, ...patch };
        setFlags(optimistic);

        try {
            const next = await setExtensionFeatureFlags(patch);
            setFlags(next);
        } catch (err) {
            setFlags(prev);
            setError(err instanceof Error ? err.message : String(err));
        }
    }, [flags]);

    return { flags, loading, error, setFlag, patchFlags, refresh };
}
