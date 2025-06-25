import { create } from "zustand";
import type { ClassStatus } from "../../time/types/schedule";
import { getCurrentStatus } from "../../time/utils/time-calculations";
import { DEFAULT_SCHEDULE } from "../../time/utils/schedule-config";

interface ClassScheduleState {
  status: ClassStatus;
  updateStatus: () => void;
}

export const useClassScheduleStore = create<ClassScheduleState>((set) => ({
  status: getCurrentStatus(new Date(), DEFAULT_SCHEDULE),
  updateStatus: () => set({ status: getCurrentStatus(new Date(), DEFAULT_SCHEDULE) }),
}));
