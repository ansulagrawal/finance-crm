import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const spinnerVariants = cva(
  'inline-block animate-spin rounded-full border-current border-t-transparent border-solid',
  {
    variants: {
      size: {
        sm: 'size-4 border-2',
        md: 'size-6 border-2',
        lg: 'size-8 border-[3px]',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

type SpinnerProps = HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof spinnerVariants>;

export function Spinner({ className, size, ...props }: SpinnerProps) {
  return (
    <span
      role='status'
      aria-label='Loading'
      className={cn(spinnerVariants({ size }), className)}
      {...props}
    />
  );
}
