import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      type: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive:
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        ghost: 'text-foreground hover:bg-muted',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      type: 'primary',
      size: 'md',
    },
  },
);

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> &
  VariantProps<typeof buttonVariants> & {
    htmlType?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
    ref?: Ref<HTMLButtonElement>;
  };

export function Button({
  className,
  type,
  size,
  htmlType = 'button',
  ref,
  ...props
}: ButtonProps) {
  return (
    <button
      ref={ref}
      type={htmlType}
      className={cn(
        'cursor-pointer',
        buttonVariants({ type, size }),
        className,
      )}
      {...props}
    />
  );
}
