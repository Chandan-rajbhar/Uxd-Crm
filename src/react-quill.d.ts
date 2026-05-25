declare module 'react-quill' {
    import React from 'react';

    export interface QuillOptions {
        theme?: string;
        modules?: any;
        formats?: string[];
        bounds?: string | HTMLElement;
        scrollingContainer?: string | HTMLElement;
        readOnly?: boolean;
        placeholder?: string;
        tabIndex?: number;
    }

    export interface ReactQuillProps extends QuillOptions {
        value?: string;
        defaultValue?: string;
        onChange?: (content: string, delta: any, source: string, editor: any) => void;
        onChangeSelection?: (selection: any, source: string, editor: any) => void;
        onFocus?: (selection: any, source: string, editor: any) => void;
        onBlur?: (previousSelection: any, source: string, editor: any) => void;
        onKeyDown?: React.EventHandler<any>;
        onKeyPress?: React.EventHandler<any>;
        onKeyUp?: React.EventHandler<any>;
        id?: string;
        className?: string;
        style?: React.CSSProperties;
    }

    export default class ReactQuill extends React.Component<ReactQuillProps> {
        focus(): void;
        blur(): void;
        getEditor(): any;
    }
}
