import { useRef } from 'react';
import { cn } from '@/lib/utils';

type OtpInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled,
  className,
}: OtpInputProps) {
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  const setDigit = (index: number, digit: string) => {
    const chars = value.split('');
    chars[index] = digit;
    onChange(chars.join('').slice(0, length));
  };

  return (
    <div className={cn('flex gap-2', className)}>
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputsRef.current[index] = el;
          }}
          type='text'
          inputMode='numeric'
          maxLength={1}
          disabled={disabled}
          value={value[index] ?? ''}
          onChange={(event) => {
            const digit = event.target.value.replace(/\D/g, '').slice(-1);
            setDigit(index, digit);
            if (digit && index < length - 1)
              inputsRef.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !value[index] && index > 0) {
              inputsRef.current[index - 1]?.focus();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData
              .getData('text')
              .replace(/\D/g, '')
              .slice(0, length);
            onChange(pasted);
            inputsRef.current[Math.min(pasted.length, length - 1)]?.focus();
          }}
          className='h-12 w-12 rounded-md border border-border bg-white text-center font-mono text-foreground text-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'
        />
      ))}
    </div>
  );
}
