import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from '@tanstack/react-table';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type ManualPagination = {
  /** 0-indexed, matching react-table's own pageIndex convention. */
  pageIndex: number;
  pageCount: number;
  onPageChange: (pageIndex: number) => void;
};

type DataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  /** When provided, pagination is driven by the caller (server-side data)
   * instead of react-table paging the given `data` array client-side. */
  manualPagination?: ManualPagination;
  onRowClick?: (row: TData) => void;
  emptyMessage?: string;
};

export function DataTable<TData, TValue>({
  columns,
  data,
  manualPagination,
  onRowClick,
  emptyMessage = 'No results.',
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      ...(manualPagination
        ? {
            pagination: {
              pageIndex: manualPagination.pageIndex,
              pageSize: data.length || 1,
            },
          }
        : {}),
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    ...(manualPagination
      ? {
          manualPagination: true,
          pageCount: manualPagination.pageCount,
        }
      : { getPaginationRowModel: getPaginationRowModel() }),
  });

  const canPreviousPage = manualPagination
    ? manualPagination.pageIndex > 0
    : table.getCanPreviousPage();
  const canNextPage = manualPagination
    ? manualPagination.pageIndex < manualPagination.pageCount - 1
    : table.getCanNextPage();
  const currentPage = manualPagination
    ? manualPagination.pageIndex
    : table.getState().pagination.pageIndex;
  const pageCount = manualPagination
    ? manualPagination.pageCount
    : table.getPageCount() || 1;

  return (
    <div className='flex flex-col gap-3'>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : (
                    <button
                      type='button'
                      disabled={!header.column.getCanSort()}
                      onClick={header.column.getToggleSortingHandler()}
                      className='flex items-center gap-1 disabled:cursor-default'
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {{ asc: '↑', desc: '↓' }[
                        header.column.getIsSorted() as string
                      ] ?? null}
                    </button>
                  )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                onClick={
                  onRowClick ? () => onRowClick(row.original) : undefined
                }
                className={onRowClick ? 'cursor-pointer' : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className='h-24 text-center text-foreground/60'
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div className='flex items-center justify-end gap-2'>
        <span className='text-foreground/60 text-sm'>
          Page {currentPage + 1} of {pageCount}
        </span>
        <Button
          type='secondary'
          size='sm'
          onClick={() =>
            manualPagination
              ? manualPagination.onPageChange(manualPagination.pageIndex - 1)
              : table.previousPage()
          }
          disabled={!canPreviousPage}
        >
          Previous
        </Button>
        <Button
          type='secondary'
          size='sm'
          onClick={() =>
            manualPagination
              ? manualPagination.onPageChange(manualPagination.pageIndex + 1)
              : table.nextPage()
          }
          disabled={!canNextPage}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
