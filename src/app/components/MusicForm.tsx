import { Button } from '@shadcn/ui/button';
import { Card } from '@shadcn/ui/card';
import { Input } from '@shadcn/ui/input';
import { Link as LinkIcon, Loader, Send } from 'lucide-react';
import { memo } from 'react';

interface MusicFormProps {
    readonly formId: string;
    readonly urlFieldName: string;
    readonly urlFieldErrors?: readonly string[];
    readonly isSubmitting: boolean;
    readonly canSubmit: boolean;
    readonly retryAfter?: number;
}

function MusicFormInner({
    formId,
    urlFieldName,
    urlFieldErrors,
    isSubmitting,
    canSubmit,
    retryAfter = 0,
}: MusicFormProps) {
    const isRateLimited = retryAfter > 0;
    return (
        <Card className='p-4 sm:p-6 shadow-sm border border-border/30 hover:border-border/60 transition-colors'>
            <Card.Content className='p-0'>
                <div className='flex flex-col items-stretch sm:items-center gap-3 sm:gap-4'>
                    <Input
                        leftIcon={<LinkIcon size={16} className='sm:w-[18px] sm:h-[18px]' />}
                        name={urlFieldName}
                        placeholder='https://www.youtube.com/watch?v=...'
                        autoComplete='off'
                        className='text-sm sm:text-base h-11 sm:h-10'
                        inputMode='url'
                        form={formId}
                    />
                    {urlFieldErrors?.[0] && (
                        <p className='text-destructive text-xs sm:text-sm -mt-1'>
                            {urlFieldErrors[0]}
                        </p>
                    )}

                    {isRateLimited && (
                        <p className='text-sm text-orange-500 font-medium'>
                            レート制限：あと{retryAfter}秒後に再試行できます
                        </p>
                    )}

                    <Button
                        type='submit'
                        disabled={!canSubmit || isRateLimited}
                        className='w-full sm:w-auto h-11 sm:h-10 text-sm sm:text-base touch-target'
                        form={formId}
                    >
                        {isSubmitting ? <Loader className='animate-spin h-4 w-4 sm:h-5 sm:w-5' /> : (
                            <>
                                <Send className='h-4 w-4 sm:h-5 sm:w-5' />
                                <p className='ml-2'>再生リストに追加</p>
                            </>
                        )}
                    </Button>
                </div>
            </Card.Content>
        </Card>
    );
}

export const MusicForm = memo(MusicFormInner);
