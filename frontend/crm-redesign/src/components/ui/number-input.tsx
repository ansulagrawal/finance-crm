import type { InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type NumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange' | 'value'
> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
  disabled,
  ...props
}: NumberInputProps) {
  const clamp = (next: number) => {
    let result = next;
    if (min !== undefined) result = Math.max(min, result);
    if (max !== undefined) result = Math.min(max, result);
    return result;
  };

  return (
    <div
      className={cn(
        'flex h-10 w-full items-stretch overflow-hidden rounded-md border border-border bg-white focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2',
        className,
      )}
    >
      <button
        type='button'
        disabled={disabled || (min !== undefined && value <= min)}
        onClick={() => onChange(clamp(value - step))}
        aria-label='Decrement'
        className='flex w-9 shrink-0 items-center justify-center text-foreground/70 hover:bg-muted disabled:pointer-events-none disabled:opacity-40'
      >
        −
      </button>
      <input
        type='number'
        inputMode='numeric'
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isNaN(next)) onChange(clamp(next));
        }}
        className='w-full flex-1 border-0 bg-transparent px-2 text-center text-foreground text-sm outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none'
        {...props}
      />
      <button
        type='button'
        disabled={disabled || (max !== undefined && value >= max)}
        onClick={() => onChange(clamp(value + step))}
        aria-label='Increment'
        className='flex w-9 shrink-0 items-center justify-center text-foreground/70 hover:bg-muted disabled:pointer-events-none disabled:opacity-40'
      >
        +
      </button>
    </div>
  );
}
