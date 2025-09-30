import { useMusicStore } from "@/app/stores/musicStore";
import { extractErrorMessage } from "../../../shared/utils/formatError";
import { useFormAlerts } from "../hooks/useFormAlerts";
import { useFormSubmission } from "../hooks/useFormSubmission";

export const useHomeForm = () => {
  const { register, handleSubmit, errors, clearErrors } = useFormSubmission();
  const { showAlert, isAnimating, successMessage, errorMessage, closeAlert } =
    useFormAlerts();
  const error = useMusicStore((store) => store.error);
  const resetError = useMusicStore((store) => store.resetError);

  const handleCloseAlert = () => {
    closeAlert();
    clearErrors("url");
    if (resetError) resetError();
  };

  const uiErrorMessage = (() => {
    const fieldMsg =
      errors.url && typeof errors.url.message === "string"
        ? errors.url.message
        : undefined;
    if (
      typeof fieldMsg === "string" &&
      fieldMsg.length > 0 &&
      fieldMsg !== "url"
    )
      return fieldMsg;
    const extracted = extractErrorMessage(error, { joinWith: " " });
    if (extracted) return extracted;
    return typeof fieldMsg === "string" ? fieldMsg : undefined;
  })();

  return {
    register,
    handleSubmit,
    errors,
    showAlert,
    isAnimating,
    successMessage,
    errorMessage: errorMessage || uiErrorMessage,
    handleCloseAlert,
    resetError: resetError || (() => {}),
  };
};
