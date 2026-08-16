import * as PopoverPrimitive from '@radix-ui/react-popover';
import { cn } from '@/lib/utils';

type MultiSelectOption = {
  label: string;
  value: string;
};

type MultiSelectProps = {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  disabled,
  className,
}: MultiSelectProps) {
  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((v) => v !== optionValue)
        : [...value, optionValue],
    );
  };

  const selectedLabels = options
    .filter((option) => value.includes(option.value))
    .map((option) => option.label);

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        disabled={disabled}
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-md border border-border bg-background px-3 text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
      >
        <span
          className={cn(
            'truncate text-left',
            selectedLabels.length === 0 && 'text-foreground/50',
          )}
        >
          {selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}
        </span>
        <span className='text-foreground/60'>▾</span>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className='z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-md border border-border bg-background p-1 shadow-lg'
          align='start'
          sideOffset={4}
        >
          {options.map((option) => {
            const checked = value.includes(option.value);
            return (
              <button
                key={option.value}
                type='button'
                onClick={() => toggle(option.value)}
                className='flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-3 py-2 text-left text-sm outline-none hover:bg-muted'
              >
                <span
                  className={cn(
                    'flex size-4 shrink-0 items-center justify-center rounded border border-border',
                    checked &&
                      'border-primary bg-primary text-primary-foreground',
                  )}
                >
                  {checked && (
                    <span className='text-[10px] leading-none'>✓</span>
                  )}
                </span>
                {option.label}
              </button>
            );
          })}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
