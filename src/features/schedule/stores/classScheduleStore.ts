import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ClassStatus } from '../types/schedule';
import { DEFAULT_SCHEDULE } from '../utils/schedule-config';
import { getCurrentStatus } from '../utils/time-calculations';

interface ClassScheduleState {
    status: ClassStatus;
    setStatus: (status: ClassStatus) => void;
    updateStatus: () => void;
    updateSettings: (
        values: Partial<Omit<ClassScheduleState, 'updateSettings' | 'updateStatus'>>,
    ) => void;
}

export const DEFAULT_CLASS_SCHEDULE_STATE: Omit<
    ClassScheduleState,
    'setStatus' | 'updateStatus' | 'updateSettings'
> = {
    status: getCurrentStatus(new Date(), DEFAULT_SCHEDULE),
};

export const useClassScheduleStore = create<ClassScheduleState>()(
    persist(
        set => {
            const base = { ...DEFAULT_CLASS_SCHEDULE_STATE };
            // setter自動生成
            const setters: Partial<ClassScheduleState> = {};
            (Object.keys(base) as (keyof typeof base)[]).forEach(key => {
                const setterName = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
                // @ts-expect-error 型安全性はinterfaceで担保
                setters[setterName] = (value: typeof base[typeof key]) => {
                    set({ [key]: value });
                };
            });
            return {
                ...base,
                ...setters,
                updateStatus: () => {
                    set({ status: getCurrentStatus(new Date(), DEFAULT_SCHEDULE) });
                },
                updateSettings: values => {
                    set(values);
                },
            } as ClassScheduleState;
        },
        {
            name: 'class-schedule-storage',
            version: 1,
            migrate: persistedState => {
                return persistedState;
            },
        },
    ),
);
