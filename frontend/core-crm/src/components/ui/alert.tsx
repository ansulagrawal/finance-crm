import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const alertVariants = cva('rounded-md border px-4 py-3', {
  variants: {
    variant: {
      info: 'border-primary/20 bg-primary/5 text-foreground',
      success: 'border-green-200 bg-green-50 text-green-900',
      warning: 'border-amber-200 bg-amber-50 text-amber-900',
      destructive: 'border-destructive/30 bg-destructive/5 text-destructive',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

type AlertProps = HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof alertVariants>;

export function Alert({ className, variant, ...props }: AlertProps) {
  return (
    <div
      role='alert'
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

export function AlertTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h5 className={cn('mb-1 font-medium leading-none', className)} {...props} />
  );
}

export function AlertDescription({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('text-sm opacity-90', className)} {...props} />;
}
