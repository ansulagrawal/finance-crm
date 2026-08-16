import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type DatePickerProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function DatePicker({ className, ...props }: DatePickerProps) {
  return (
    <input
      type='date'
      className={cn(
        'flex h-10 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}
