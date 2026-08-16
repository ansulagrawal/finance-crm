import { Eye, EyeOff } from 'lucide-react';
import { type InputHTMLAttributes, useState } from 'react';
import { cn } from '@/lib/utils';

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className='relative'>
      <input
        type={visible ? 'text' : 'password'}
        className={cn(
          'flex h-10 w-full rounded-md border border-border bg-background px-3 pr-10 text-foreground text-sm placeholder:text-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
      <button
        type='button'
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className='absolute top-1/2 right-3 -translate-y-1/2 text-foreground/60 hover:text-foreground focus-visible:outline-none'
      >
        {visible ? <EyeOff className='size-4' /> : <Eye className='size-4' />}
      </button>
    </div>
  );
}
