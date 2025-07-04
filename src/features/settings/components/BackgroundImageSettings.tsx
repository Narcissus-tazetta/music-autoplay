import { useState } from 'react';
import { HiCheck, HiFolder, HiLink, HiX } from 'react-icons/hi';

interface BackgroundImageSettingsProps {
    mode: 'dark' | 'light';
    showBackgroundImage: boolean;
    setShowBackgroundImage: (v: boolean) => void;
    backgroundImage: string;
    setBackgroundImage: (imageData: string, fileName?: string) => Promise<void>;
    backgroundImageFileName: string;
}

export const BackgroundImageSettings = ({
    mode,
    showBackgroundImage,
    setShowBackgroundImage,
    backgroundImage,
    setBackgroundImage,
    backgroundImageFileName,
}: BackgroundImageSettingsProps) => {
    const [inputMethod, setInputMethod] = useState<'file' | 'url'>('file');
    const [imageUrl, setImageUrl] = useState('');
    const [isLoadingUrl, setIsLoadingUrl] = useState(false);

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            if (file.size > 100 * 1024 * 1024) {
                window.alert('ファイルサイズは100MB以下にしてください');
                return;
            }
            if (!file.type.startsWith('image/')) {
                window.alert('画像ファイルを選択してください');
                return;
            }

            const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!supportedFormats.includes(file.type.toLowerCase())) {
                window.alert(
                    'サポートされている形式: JPEG, PNG, GIF, WebP\n（HEIC形式はサポートされていません）',
                );
                return;
            }

            try {
                const reader = new window.FileReader();
                reader.onload = async ev => {
                    const result = ev.target?.result as string;
                    await setBackgroundImage(result, file.name);
                };
                reader.readAsDataURL(file);
            } catch (error) {
                console.error('画像の読み込みに失敗しました:', error);
                window.alert('画像の読み込みに失敗しました');
            }
        }
    };

    const handleUrlLoad = async () => {
        if (!imageUrl.trim()) {
            window.alert('URLを入力してください');
            return;
        }

        setIsLoadingUrl(true);
        try {
            const url = new URL(imageUrl.trim());
            if (!url.protocol.startsWith('http')) throw new Error('HTTPまたはHTTPSのURLを入力してください');

            const response = await fetch(imageUrl.trim());
            if (!response.ok) throw new Error(`画像の読み込みに失敗しました: ${response.status}`);

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.startsWith('image/')) throw new Error('指定されたURLは画像ではありません');

            const supportedFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!supportedFormats.some(format => contentType.includes(format.split('/')[1])))
                throw new Error('サポートされている形式: JPEG, PNG, GIF, WebP');
            const blob = await response.blob();
            if (blob.size > 100 * 1024 * 1024) throw new Error('ファイルサイズは100MB以下にしてください');

            const reader = new window.FileReader();
            reader.onload = async ev => {
                const result = ev.target?.result as string;
                const fileName = url.pathname.split('/').pop() || 'URL画像';
                await setBackgroundImage(result, fileName);
                setImageUrl('');
            };
            reader.readAsDataURL(blob);
        } catch (error) {
            console.error('URL画像の読み込みに失敗しました:', error);
            window.alert(
                `エラー: ${error instanceof Error ? error.message : '不明なエラーが発生しました'}`,
            );
        } finally {
            setIsLoadingUrl(false);
        }
    };

    return (
        <div className='flex flex-col gap-2'>
            <label
                className={`flex items-center justify-between cursor-pointer py-2 ${
                    mode === 'dark' ? 'text-white' : 'text-black'
                }`}
            >
                <span className='block font-medium'>背景画像</span>
                <input
                    type='checkbox'
                    className='toggle toggle-primary'
                    checked={showBackgroundImage}
                    onChange={e => {
                        setShowBackgroundImage(e.target.checked);
                    }}
                />
            </label>

            {showBackgroundImage && (
                <div className='ml-4 space-y-3'>
                    {backgroundImage && (
                        <div className='bg-gray-100 dark:bg-gray-800 rounded-lg p-3 border'>
                            <div className='flex items-center justify-between'>
                                <div className='flex items-center space-x-2'>
                                    {backgroundImage.includes('data:image/png;base64,AAAAIGZ0eXBoZWlj')
                                        ? <HiX className='w-5 h-5 text-red-500' />
                                        : <HiCheck className='w-5 h-5 text-blue-500' />}
                                    <div>
                                        <div className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                                            {backgroundImageFileName || '選択された画像'}
                                        </div>
                                        <div className='text-xs text-gray-500 dark:text-gray-400'>
                                            {backgroundImage.includes('data:image/png;base64,AAAAIGZ0eXBoZWlj')
                                                ? '❌ HEIC形式はサポートされていません'
                                                : '画像が適用されています'}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        setBackgroundImage('', '').catch((error: unknown) => {
                                            console.error(error);
                                        });
                                    }}
                                    className='w-8 h-8 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex items-center justify-center'
                                    title='削除'
                                >
                                    <HiX className='w-4 h-4' />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className='flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden'>
                        <button
                            onClick={() => {
                                setInputMethod('file');
                            }}
                            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                                inputMethod === 'file'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            <HiFolder className='w-4 h-4 inline mr-1' />
                            ファイル
                        </button>
                        <button
                            onClick={() => {
                                setInputMethod('url');
                            }}
                            className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                                inputMethod === 'url'
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                            }`}
                        >
                            <HiLink className='w-4 h-4 inline mr-1' />
                            URL
                        </button>
                    </div>

                    {inputMethod === 'file' && (
                        <div className='space-y-2'>
                            <label className='block'>
                                <div
                                    className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors ${
                                        backgroundImage
                                            ? 'border-blue-300 bg-blue-50 dark:bg-blue-950 dark:border-blue-600'
                                            : 'border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500'
                                    }`}
                                >
                                    <div className='space-y-2'>
                                        <div className='flex justify-center'>
                                            {backgroundImage
                                                ? <HiCheck className='w-8 h-8 text-blue-500' />
                                                : <HiFolder className='w-8 h-8 text-gray-400' />}
                                        </div>
                                        <div className='text-sm font-medium'>
                                            {backgroundImage ? 'ファイルが選択済み' : 'ファイルを選択'}
                                        </div>
                                        <div className='text-xs opacity-70'>100MB以下のJPEG・PNG・GIF・WebP画像</div>
                                    </div>
                                </div>
                                <input
                                    type='file'
                                    accept='image/jpeg,image/jpg,image/png,image/gif,image/webp'
                                    onChange={handleImageUpload}
                                    className='hidden'
                                />
                            </label>
                        </div>
                    )}

                    {inputMethod === 'url' && (
                        <div className='space-y-2'>
                            <div className='flex gap-2'>
                                <input
                                    type='url'
                                    value={imageUrl}
                                    onChange={e => {
                                        setImageUrl(e.target.value);
                                    }}
                                    placeholder='https://example.com/image.jpg'
                                    className='flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                                    disabled={isLoadingUrl}
                                />
                                <button
                                    onClick={() => {
                                        handleUrlLoad().catch((error: unknown) => {
                                            console.error(error);
                                        });
                                    }}
                                    disabled={isLoadingUrl || !imageUrl.trim()}
                                    className='px-3 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors'
                                >
                                    {isLoadingUrl ? '読込中...' : '読込'}
                                </button>
                            </div>
                            <div className='text-xs text-gray-500 dark:text-gray-400'>
                                対応形式: JPEG, PNG, GIF, WebP（100MB以下）
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
