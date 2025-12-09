import * as React from 'react';

import { cn } from '~/utils/cn';

function Table({ className, ...props }: React.ComponentProps<'table'>) {
    return (
        <div
            data-slot='table-container'
            className='relative w-full overflow-x-auto'
        >
            <table
                data-slot='table'
                className={cn('w-full caption-bottom text-sm', className)}
                {...props}
            />
        </div>
    );
}

function TableHeader({ className, ...props }: React.ComponentProps<'thead'>) {
    return (
        <thead
            data-slot='table-header'
            className={cn('[&_tr]:border-b', className)}
            {...props}
        />
    );
}
Table.Header = TableHeader;

function TableBody({ className, ...props }: React.ComponentProps<'tbody'>) {
    return (
        <tbody
            data-slot='table-body'
            className={cn('[&_tr:last-child]:border-0', className)}
            {...props}
        />
    );
}
Table.Body = TableBody;

function TableFooter({ className, ...props }: React.ComponentProps<'tfoot'>) {
    return (
        <tfoot
            data-slot='table-footer'
            className={cn(
                'bg-muted/50 border-t font-medium [&>tr]:last:border-b-0',
                className,
            )}
            {...props}
        />
    );
}
Table.Footer = TableFooter;

function TableRow<C extends React.ElementType = 'tr'>({
    as: Component = 'tr',
    ...props
}: React.ComponentProps<C> & {
    as?: C;
}) {
    return (
        <Component
            data-slot='table-row'
            className={cn(
                'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors duration-500',
                'className' in props && props.className,
            )}
            {...props}
        />
    );
}
Table.Row = TableRow;

function TableHead<C extends React.ElementType = 'th'>({
    as: Component = 'th',
    ...props
}: React.ComponentProps<C> & {
    as?: C;
}) {
    return (
        <Component
            data-slot='table-head'
            className={cn(
                'text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5',
                'className' in props && props.className,
            )}
            {...props}
        />
    );
}
Table.Head = TableHead;

function TableCell<C extends React.ElementType = 'td'>({
    as: Component = 'td',
    ...props
}: React.ComponentProps<C> & {
    as?: C;
}) {
    return (
        <Component
            data-slot='table-cell'
            className={cn(
                'p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5',
                'className' in props && props.className,
            )}
            {...props}
        />
    );
}
Table.Cell = TableCell;

function TableCaption({
    className,
    ...props
}: React.ComponentProps<'caption'>) {
    return (
        <caption
            data-slot='table-caption'
            className={cn('text-muted-foreground mt-4 text-sm', className)}
            {...props}
        />
    );
}
Table.Caption = TableCaption;

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
