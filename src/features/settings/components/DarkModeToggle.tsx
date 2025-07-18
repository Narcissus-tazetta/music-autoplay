interface DarkModeToggleProps {
    mode: 'dark' | 'light';
    setMode: (v: 'dark' | 'light') => void;
}

export const DarkModeToggle = ({ mode, setMode }: DarkModeToggleProps) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newMode = e.target.checked ? 'dark' : 'light';
        setMode(newMode);
    };

    return (
        <label
            className={`flex items-center justify-between cursor-pointer py-2 ${
                mode === 'dark' ? 'text-white' : 'text-black'
            }`}
        >
            <span className='block font-medium'>ダークモード</span>
            <input
                type='checkbox'
                className='toggle toggle-primary'
                checked={mode === 'dark'}
                onChange={handleChange}
            />
        </label>
    );
};
