import { useVirtualizer } from '@tanstack/react-virtual';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { cn } from '@/lib/utils';

type VirtualListProps<T> = {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
};

export function VirtualList<T>({
  items,
  itemHeight,
  height,
  renderItem,
  className,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
  });

  return (
    <div
      ref={parentRef}
      className={cn(
        'overflow-y-auto rounded-md border border-border',
        className,
      )}
      style={{ height }}
    >
      <div
        className='relative w-full'
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            className='absolute top-0 left-0 w-full'
            style={{
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
