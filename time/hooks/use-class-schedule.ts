import { useState, useEffect, useRef } from "react";
import type { ClassStatus } from "../types/schedule";
import { getCurrentStatus } from "../utils/time-calculations";
import { DEFAULT_SCHEDULE } from "../utils/schedule-config";

export const useClassSchedule = () => {
  const [status, setStatus] = useState<ClassStatus>(() =>
    getCurrentStatus(new Date(), DEFAULT_SCHEDULE)
  );
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isActiveRef = useRef(true);

  const updateStatus = () => {
    if (isActiveRef.current) {
      setStatus(getCurrentStatus(new Date(), DEFAULT_SCHEDULE));
    }
  };

  useEffect(() => {
    updateStatus();

    intervalRef.current = setInterval(updateStatus, 10);

    const handleVisibilityChange = () => {
      isActiveRef.current = document.visibilityState === "visible";
      if (isActiveRef.current) {
        updateStatus();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return status;
};
