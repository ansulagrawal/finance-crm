import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';

type FileUploadProps = {
  value?: File[];
  onChange: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
};

export function FileUpload({
  value,
  onChange,
  accept,
  multiple,
  disabled,
  className,
}: FileUploadProps) {
  const inputId = useId();
  const [files, setFiles] = useState<File[]>(value ?? []);

  const setSelection = (fileList: FileList | null) => {
    const next = fileList ? Array.from(fileList) : [];
    setFiles(next);
    onChange(next);
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label
        htmlFor={inputId}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-border border-dashed bg-background px-4 py-6 text-center text-foreground/60 text-sm transition-colors hover:border-primary hover:text-primary',
          disabled && 'pointer-events-none cursor-not-allowed opacity-50',
        )}
      >
        <Upload className='size-5' />
        <span>
          {files.length > 0
            ? files.map((file) => file.name).join(', ')
            : 'Click to upload or drag and drop'}
        </span>
      </label>
      <input
        id={inputId}
        type='file'
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        onChange={(event) => setSelection(event.target.files)}
        className='sr-only'
      />
    </div>
  );
}
