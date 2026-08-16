import * as ToastPrimitive from '@radix-ui/react-toast';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

type ToastVariant = 'default' | 'destructive';

type ToastItem = {
  id: number;
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
};

let toastIdCounter = 0;
let toasts: ToastItem[] = [];
const listeners = new Set<(toasts: ToastItem[]) => void>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

export function toast({
  title,
  description,
  variant = 'default',
}: Omit<ToastItem, 'id'>) {
  const id = ++toastIdCounter;
  toasts = [...toasts, { id, title, description, variant }];
  emit();
  return id;
}

function dismiss(id: number) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

export function useToast() {
  const [items, setItems] = useState(toasts);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  return { toasts: items, dismiss };
}

export function Toaster() {
  const { toasts: items, dismiss } = useToast();

  return (
    <ToastPrimitive.Provider swipeDirection='right'>
      {items.map(({ id, title, description, variant }) => (
        <ToastPrimitive.Root
          key={id}
          duration={4000}
          onOpenChange={(open) => {
            if (!open) dismiss(id);
          }}
          className={cn(
            'relative flex flex-col gap-1 rounded-md border border-border bg-background p-4 shadow-lg',
            variant === 'destructive' &&
              'border-destructive bg-destructive text-destructive-foreground',
          )}
        >
          {title && (
            <ToastPrimitive.Title className='font-medium text-sm'>
              {title}
            </ToastPrimitive.Title>
          )}
          {description && (
            <ToastPrimitive.Description
              className={cn(
                'text-sm',
                variant === 'destructive'
                  ? 'text-destructive-foreground/80'
                  : 'text-foreground/70',
              )}
            >
              {description}
            </ToastPrimitive.Description>
          )}
          <ToastPrimitive.Close
            aria-label='Close'
            className={cn(
              'absolute top-2 right-2',
              variant === 'destructive'
                ? 'text-destructive-foreground/70 hover:text-destructive-foreground'
                : 'text-foreground/50 hover:text-foreground',
            )}
          >
            ✕
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className='fixed right-0 bottom-0 z-100 flex w-full max-w-sm flex-col gap-2 p-4' />
    </ToastPrimitive.Provider>
  );
}
