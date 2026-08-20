import * as PopoverPrimitive from '@radix-ui/react-popover';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';

export type ComboboxOption = {
  label: string;
  value: string;
};

type ComboboxProps = {
  value: string;
  onValueChange: (value: string) => void;
  search: string;
  onSearchChange: (search: string) => void;
  options: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

export function Combobox({
  value,
  onValueChange,
  search,
  onSearchChange,
  options,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No results.',
  disabled,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((option) => option.value === value)?.label;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        disabled={disabled}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-border bg-white px-3 text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span
          className={cn(
            'truncate text-left',
            !selectedLabel && 'text-foreground/50',
          )}
        >
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-foreground/60 transition-transform',
            open && 'rotate-180',
          )}
        />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className='z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-white p-1 shadow-lg'
          align='start'
          sideOffset={4}
        >
          <Input
            autoFocus
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className='mb-1 h-8 text-xs'
          />
          <div className='max-h-60 overflow-y-auto'>
            {options.length ? (
              options.map((option) => (
                <button
                  key={option.value}
                  type='button'
                  onClick={() => {
                    onValueChange(option.value);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex w-full cursor-pointer select-none items-center rounded-sm px-3 py-2 text-left text-sm outline-none hover:bg-muted',
                    option.value === value && 'bg-muted',
                  )}
                >
                  {option.label}
                </button>
              ))
            ) : (
              <p className='px-3 py-2 text-foreground/50 text-sm'>
                {emptyText}
              </p>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
