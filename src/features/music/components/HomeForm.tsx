import { Input } from "../../../shared/components/input";
import { Button } from "../../../shared/components/button";
import { SendIcon } from "lucide-react";
import { FormAlert } from "./FormAlert";
import { useHomeForm } from "./useHomeForm";
import { YOUTUBE_PATTERN } from "../../../shared/libs/utils";

interface HomeFormProps {
  mode: "dark" | "light";
}

export const HomeForm: React.FC<HomeFormProps> = ({ mode }) => {
  const {
    register,
    handleSubmit,
    showAlert,
    isAnimating,
    successMessage,
    errorMessage,
    handleCloseAlert,
    handleCloseSuccessAlert,
    resetError,
  } = useHomeForm();

  return (
    <form className="flex flex-col items-center gap-4" onSubmit={handleSubmit}>
      <div className="w-full flex flex-col items-center">
        <Input
          className="w-[500px]"
          {...register("url", {
            validate: (value) => {
              if (value.trim().toLowerCase() === "admin") return true;
              if (value.length >= 32 && !/^https?:\/\//.test(value)) return true;
              if (!value) return "URLを入力してください";
              if (!YOUTUBE_PATTERN.test(value)) return "有効なYouTubeのURLを入力してください";
              return true;
            },
            onChange() {
              resetError();
            },
          })}
          autoComplete="off"
          placeholder="YouTubeのURLまたは管理者コード"
          aria-label="YouTubeのURL"
        />

        <FormAlert
          isVisible={showAlert}
          isAnimating={isAnimating}
          errorMessage={errorMessage}
          successMessage={successMessage}
          onClose={errorMessage ? handleCloseAlert : handleCloseSuccessAlert}
        />
      </div>

      <Button
        type="submit"
        className="flex w-xs gap-2"
        style={{
          background: mode === "dark" ? "#E8EAED" : "#212225",
          color: mode === "dark" ? "#212225" : "#fff",
          border: "none",
        }}
      >
        <SendIcon size={12} />
        <p>送信</p>
      </Button>
    </form>
  );
};
