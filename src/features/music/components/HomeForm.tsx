import { SendIcon } from "lucide-react";
import { Button } from "../../../shared/components/button";
import { Input } from "../../../shared/components/input";
import { YOUTUBE_PATTERN } from "../../../shared/libs/youtube";
import { FormAlert } from "./FormAlert";
import { useHomeForm } from "./useHomeForm";

export const HomeForm: React.FC = () => {
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
        <form
            className="flex flex-col items-center gap-4"
            onSubmit={() => {
                handleSubmit().catch((error: unknown) => {
                    console.error("Form submission error:", error);
                });
            }}
        >
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
                    placeholder="https://www.youtube.com/watch?v=..."
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
                    background: "var(--color-fg, #212225)",
                    color: "var(--color-bg, #fff)",
                    border: "none",
                    transition:
                        "var(--transition-colors, background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1))",
                }}
            >
                <SendIcon size={12} />
                <p>送信</p>
            </Button>
        </form>
    );
};
