import { useCallback, useEffect, useState } from "react";

export const useFormAlerts = () => {
  const [showAlert, setShowAlert] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | undefined>(
    undefined,
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );

  const showSuccess = useCallback((message: string) => {
    setSuccessMessage(message);
    setShowAlert(true);
    setIsAnimating(false);
  }, []);

  const showError = useCallback((message: string) => {
    setErrorMessage(message);
    setShowAlert(true);
    setIsAnimating(false);
  }, []);

  const closeAlert = useCallback(() => {
    setIsAnimating(true);
    setTimeout(() => {
      setShowAlert(false);
      setIsAnimating(false);
      setErrorMessage(undefined);
      setSuccessMessage(undefined);
    }, 200);
  }, []);

  useEffect(() => {
    if (errorMessage && showAlert) {
      const timer = setTimeout(closeAlert, 3000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [errorMessage, showAlert, closeAlert]);

  useEffect(() => {
    if (successMessage && showAlert) {
      const timer = setTimeout(closeAlert, 5000);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [successMessage, showAlert, closeAlert]);

  return {
    showAlert,
    isAnimating,
    successMessage,
    errorMessage,
    showSuccess,
    showError,
    closeAlert,
  };
};
