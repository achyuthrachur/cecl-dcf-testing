'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  emptyMessage?: string;
  loading?: boolean;
  striped?: boolean;
  compact?: boolean;
  className?: string;
  onRowClick?: (item: T, index: number) => void;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No data available',
  loading = false,
  striped = true,
  compact = false,
  className,
  onRowClick,
}: DataTableProps<T>) {
  const alignments = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  return (
    <div
      className={cn('overflow-hidden rounded-lg border border-slate-200', className)}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={cn(
                    'text-xs font-semibold text-slate-600 uppercase tracking-wider',
                    compact ? 'px-4 py-2' : 'px-6 py-3',
                    alignments[column.align || 'left'],
                    column.headerClassName
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className={cn(
                    'text-center text-slate-500',
                    compact ? 'px-4 py-8' : 'px-6 py-12'
                  )}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                    <span>Loading...</span>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className={cn(
                    'text-center text-slate-500',
                    compact ? 'px-4 py-8' : 'px-6 py-12'
                  )}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((item, index) => (
                <tr
                  key={keyExtractor(item, index)}
                  className={cn(
                    'transition-colors',
                    striped && index % 2 === 1 && 'bg-slate-50/50',
                    onRowClick && 'cursor-pointer hover:bg-primary-50'
                  )}
                  onClick={() => onRowClick?.(item, index)}
                >
                  {columns.map((column) => (
                    <td
                      key={`${keyExtractor(item, index)}-${column.key}`}
                      className={cn(
                        'text-sm text-slate-900 whitespace-nowrap',
                        compact ? 'px-4 py-2' : 'px-6 py-4',
                        alignments[column.align || 'left'],
                        column.className
                      )}
                    >
                      {column.render
                        ? column.render(item, index)
                        : (item[column.key] as ReactNode)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
