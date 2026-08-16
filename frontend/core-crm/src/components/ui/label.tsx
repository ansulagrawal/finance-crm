import * as LabelPrimitive from '@radix-ui/react-label';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        'font-medium text-foreground text-sm leading-none',
        className,
      )}
      {...props}
    />
  );
}
