import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Textarea({ className, ...props }: TextareaProps) {
  return (
    <textarea
      className={cn(
        'flex min-h-20 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground text-sm placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
