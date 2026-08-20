import { useRouter } from '@tanstack/react-router';
import { AlertTriangle, Home, RotateCw, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

function Shell({
  icon,
  title,
  message,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <div className='flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center'>
      <div className='flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground'>
        {icon}
      </div>
      <div className='space-y-1'>
        <h2 className='font-display font-semibold text-lg'>{title}</h2>
        <p className='max-w-md text-muted-foreground text-sm'>{message}</p>
      </div>
      {children}
    </div>
  );
}

export function RouteErrorState({ error }: { error: Error }) {
  const router = useRouter();

  return (
    <Shell
      icon={<AlertTriangle className='size-6' />}
      title='Something went wrong'
      message="This page couldn't be loaded. Retrying often clears it; if it keeps happening, send the details below to the tech team."
    >
      <div className='flex gap-2'>
        <Button onClick={() => router.invalidate()}>
          <RotateCw className='mr-2 size-4' />
          Try again
        </Button>
        <Button type='ghost' onClick={() => router.navigate({ to: '/' })}>
          <Home className='mr-2 size-4' />
          Back to leads
        </Button>
      </div>

      {error?.message && (
        <details className='mt-2 w-full max-w-xl text-left'>
          <summary className='cursor-pointer text-muted-foreground text-xs hover:text-foreground'>
            Technical details
          </summary>
          <pre className='mt-2 overflow-x-auto rounded-md border border-border bg-muted p-3 text-muted-foreground text-xs'>
            {error.message}
          </pre>
        </details>
      )}
    </Shell>
  );
}

export function RouteNotFoundState() {
  const router = useRouter();

  return (
    <Shell
      icon={<SearchX className='size-6' />}
      title='Page not found'
      message='That page does not exist, or it may have been moved.'
    >
      <Button onClick={() => router.navigate({ to: '/' })}>
        <Home className='mr-2 size-4' />
        Back to leads
      </Button>
    </Shell>
  );
}
