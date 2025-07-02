import { useEffect } from "react";
import { useClassScheduleStore } from "../stores/classScheduleStore";

export function useClassSchedule() {
  const status = useClassScheduleStore((state) => state.status);
  const updateStatus = useClassScheduleStore((state) => state.updateStatus);

  useEffect(() => {
    updateStatus();
    const interval = setInterval(updateStatus, 100);
    return () => clearInterval(interval);
  }, [updateStatus]);

  return status;
}
