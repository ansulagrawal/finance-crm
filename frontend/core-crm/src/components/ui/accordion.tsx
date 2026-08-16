import * as AccordionPrimitive from '@radix-ui/react-accordion';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const Accordion = AccordionPrimitive.Root;

export function AccordionItem({
  className,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Item>) {
  return (
    <AccordionPrimitive.Item
      className={cn('border-border border-b', className)}
      {...props}
    />
  );
}

export function AccordionTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className='flex'>
      <AccordionPrimitive.Trigger
        className={cn(
          'flex flex-1 items-center justify-between py-3 text-left font-medium text-foreground text-sm transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 [&[data-state=open]>span]:rotate-180',
          className,
        )}
        {...props}
      >
        {children}
        <span className='text-foreground/60 transition-transform'>▾</span>
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

export function AccordionContent({
  className,
  children,
  ...props
}: ComponentProps<typeof AccordionPrimitive.Content>) {
  return (
    <AccordionPrimitive.Content
      className={cn(
        'overflow-hidden text-sm data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down',
        className,
      )}
      {...props}
    >
      <div className='pb-3'>{children}</div>
    </AccordionPrimitive.Content>
  );
}
