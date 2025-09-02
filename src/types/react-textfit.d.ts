declare module 'react-textfit' {
    import * as React from 'react';
    export interface TextfitProps {
        mode?: 'single' | 'multi';
        forceSingleModeWidth?: boolean;
        min?: number;
        max?: number;
        throttle?: number;
        onReady?: (fontSize: number) => void;
        style?: React.CSSProperties;
        className?: string;
        children?: React.ReactNode;
    }
    export class Textfit extends React.Component<TextfitProps> {}
    export default Textfit;
}
