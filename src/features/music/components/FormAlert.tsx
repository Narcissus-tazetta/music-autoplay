import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../../../shared/components/alert';

interface FormAlertProps {
    isVisible: boolean;
    isAnimating: boolean;
    errorMessage?: string;
    successMessage?: string;
    onClose: () => void;
}

export const FormAlert = ({
    isVisible,
    isAnimating,
    errorMessage,
    successMessage,
    onClose,
}: FormAlertProps) => {
    if (!isVisible || (!errorMessage && !successMessage)) return null;

    const isError = Boolean(errorMessage);
    const isSuccess = Boolean(successMessage);

    return (
        <>
            {isError && (
                <Alert
                    variant='destructive'
                    className={`mt-2 w-full max-w-[500px] relative transition-opacity duration-200 
            bg-red-50 border-red-200 text-red-800
            dark:bg-[#5a2328]/90 dark:border-[#ff4d4f]/80 dark:text-white
            ${isAnimating ? 'opacity-0' : 'opacity-100'}`}
                >
                    <AlertCircle />
                    <button
                        onClick={onClose}
                        className='absolute top-2 right-2 p-1 rounded-md hover:bg-red-100 dark:hover:bg-[#ff4d4f]/20 transition-colors'
                        aria-label='アラートを閉じる'
                    >
                        <X size={14} />
                    </button>
                    <AlertTitle>エラーが発生しました</AlertTitle>
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            {isSuccess && (
                <Alert
                    variant='default'
                    className={`mt-2 w-full max-w-[500px] relative transition-opacity duration-200 
            bg-green-50 border-green-200 text-green-800
            dark:bg-[#234032]/90 dark:border-[#7fffd4]/60 dark:text-[#eafff6]
            ${isAnimating ? 'opacity-0' : 'opacity-100'}`}
                >
                    <CheckCircle2 />
                    <button
                        onClick={onClose}
                        className='absolute top-2 right-2 p-1 rounded-md hover:bg-green-100 dark:hover:bg-[#7fffd4]/20 transition-colors'
                        aria-label='アラートを閉じる'
                    >
                        <X size={14} />
                    </button>
                    <AlertTitle>楽曲を追加しました</AlertTitle>
                    <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
            )}
        </>
    );
};
