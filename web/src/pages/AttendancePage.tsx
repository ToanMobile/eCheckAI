import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Search,
  Filter,
  RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { cn, formatTime, formatDate } from '@/lib/utils';
import type {
  AttendanceRecord,
  AttendanceFilters,
  AttendanceStatus,
  PaginatedResponse,
} from '@/types';

const PER_PAGE = 50;

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'on_time', label: 'Đúng giờ' },
  { value: 'late', label: 'Muộn' },
  { value: 'early_leave', label: 'Về sớm' },
  { value: 'absent', label: 'Vắng' },
  { value: 'pending', label: 'Chờ xác nhận' },
];

async function fetchAttendance(
  filters: AttendanceFilters,
): Promise<PaginatedResponse<AttendanceRecord>['data']> {
  const params: Record<string, unknown> = {
    page: filters.page ?? 1,
    limit: filters.limit ?? PER_PAGE,
  };
  if (filters.date_from) params.date_from = filters.date_from;
  if (filters.date_to) params.date_to = filters.date_to;
  if (filters.branch_id) params.branch_id = filters.branch_id;
  if (filters.status) params.status = filters.status;
  if (filters.search) params.search = filters.search;

  const { data } = await api.get<PaginatedResponse<AttendanceRecord>>(
    '/attendance',
    { params },
  );
  return data.data;
}

async function fetchBranchOptions(): Promise<
  { id: string; name: string }[]
> {
  const { data } = await api.get<{
    data: { items: { id: string; name: string }[] };
  }>('/branches', { params: { limit: 200 } });
  return data.data.items;
}

// ── Sortable column header ──
function SortHeader({
  label,
  sorted,
  onClick,
}: {
  label: string;
  sorted: false | 'asc' | 'desc';
  onClick: (event: unknown) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 text-left hover:text-neutral-950 transition-colors"
    >
      {label}
      {sorted === 'asc' ? (
        <ChevronUp className="w-3.5 h-3.5" />
      ) : sorted === 'desc' ? (
        <ChevronDown className="w-3.5 h-3.5" />
      ) : (
        <ChevronsUpDown className="w-3.5 h-3.5 text-neutral-400" />
      )}
    </button>
  );
}

const COLUMNS: ColumnDef<AttendanceRecord>[] = [
  {
    accessorKey: 'employee_code',
    header: 'Mã NV',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-neutral-600">
        {String(getValue())}
      </span>
    ),
    size: 90,
  },
  {
    accessorKey: 'full_name',
    header: 'Họ tên',
    cell: ({ getValue }) => (
      <span className="font-medium text-neutral-950">{String(getValue())}</span>
    ),
    size: 180,
  },
  {
    accessorKey: 'branch_name',
    header: 'Chi nhánh',
    size: 160,
  },
  {
    accessorKey: 'work_date',
    header: 'Ngày',
    cell: ({ getValue }) => formatDate(String(getValue())),
    size: 100,
  },
  {
    accessorKey: 'check_in',
    header: 'Gỏ vào',
    cell: ({ getValue }) => {
      const val = getValue();
      return val ? (
        <span className="font-mono text-sm">{formatTime(String(val))}</span>
      ) : (
        <span className="text-neutral-400">—</span>
      );
    },
    size: 80,
  },
  {
    accessorKey: 'check_out',
    header: 'Gỏ ra',
    cell: ({ getValue }) => {
      const val = getValue();
      return val ? (
        <span className="font-mono text-sm">{formatTime(String(val))}</span>
      ) : (
        <span className="text-neutral-400">—</span>
      );
    },
    size: 80,
  },
  {
    accessorKey: 'status',
    header: 'Trạng thái',
    cell: ({ getValue }) => (
      <StatusBadge status={getValue() as AttendanceStatus} />
    ),
    size: 120,
  },
  {
    accessorKey: 'type',
    header: 'Luại',
    cell: ({ getValue }) => (
      <span
        className={cn(
          'text-xs font-medium',
          getValue() === 'auto' ? 'text-primary-600' : 'text-neutral-500',
        )}
      >
        {getValue() === 'auto' ? 'Tự động' : 'Thủ công'}
      </span>
    ),
    size: 90,
  },
  {
    accessorKey: 'note',
    header: 'Ghi chú',
    cell: ({ getValue }) => {
      const val = getValue();
      return val ? (
        <span className="text-xs text-neutral-600 line-clamp-1">{String(val)}</span>
      ) : (
        <span className="text-neutral-300">—</span>
      );
    },
    size: 160,
  },
];

export function AttendancePage(): JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<AttendanceFilters>({
    date_from: format(new Date(), 'yyyy-MM-dd'),
    date_to: format(new Date(), 'yyyy-MM-dd'),
    status: undefined,
    branch_id: '',
    search: '',
  });
  const [isExporting, setIsExporting] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['attendance', filters, page],
    queryFn: () => fetchAttendance({ ...filters, page, limit: PER_PAGE }),
    placeholderData: (prev) => prev,
  });

  const { data: branches } = useQuery({
    queryKey: ['branches-options'],
    queryFn: fetchBranchOptions,
    staleTime: 300_000,
  });

  const table = useReactTable({
    data: data?.items ?? [],
    columns: COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: data?.totalPages ?? 1,
  });

  const totalPages = data?.totalPages ?? 1;

  const handleFilterChange = useCallback(
    (key: keyof AttendanceFilters, value: string) => {
      setFilters((prev) => ({ ...prev, [key]: value || undefined }));
      setPage(1);
    },
    [],
  );

  async function handleExport(): Promise<void> {
    setIsExporting(true);
    try {
      const params: Record<string, unknown> = {};
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.branch_id) params.branch_id = filters.branch_id;
      if (filters.status) params.status = filters.status;

      const response = await api.get('/attendance/export', {
        params,
        responseType: 'blob',
      });

      const url = URL.createObjectURL(response.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chamcong-${filters.date_from ?? 'all'}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-h1">Chấm công</h1>
          <p className="text-body-sm mt-1">
            {data ? `${data.total.toLocaleString('vi-VN')} bản ghi` : 'Đang tải...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="btn-secondary"
            aria-label="Làm mới"
          >
            <RefreshCw
              className={cn('w-4 h-4', isFetching && 'animate-spin')}
              aria-hidden="true"
            />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting}
            className="btn-primary"
          >
            <Download className="w-4 h-4" aria-hidden="true" />
            {isExporting ? 'Đang xất...' : 'Xuất CSV'}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-neutral-500" aria-hidden="true" />
          <span className="text-sm font-medium text-neutral-700">Bộ lọc</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-1">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Tìm nhân viên..."
              className="input pl-8"
              value={filters.search ?? ''}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              aria-label="Tìm kiếm nhân viên"
            />
          </div>

          {/* Date from */}
          <div>
            <input
              type="date"
              className="input"
              value={filters.date_from ?? ''}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
              aria-label="Từ ngày"
            />
          </div>

          {/* Date to */}
          <div>
            <input
              type="date"
              className="input"
              value={filters.date_to ?? ''}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
              aria-label="Đến ngày"
            />
          </div>

          {/* Branch */}
          <div>
            <select
              className="input"
              value={filters.branch_id ?? ''}
              onChange={(e) => handleFilterChange('branch_id', e.target.value)}
              aria-label="Chi nhánh"
            >
              <option value="">Tất cả chi nhánh</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              className="input"
              value={filters.status ?? ''}
              onChange={(e) =>
                handleFilterChange(
                  'status',
                  e.target.value as AttendanceStatus,
                )
              }
              aria-label="Trạng thái"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id} className="border-b border-neutral-200 bg-neutral-50">
                  {hg.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-xs font-medium text-neutral-600 uppercase tracking-wider whitespace-nowrap"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <SortHeader
                          label={String(
                            flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            ),
                          )}
                          sorted={header.column.getIsSorted()}
                          onClick={header.column.getToggleSortingHandler() ?? ((_e: unknown) => {})}
                        />
                      ) : (
                        flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    {COLUMNS.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-4 py-16 text-center text-sm text-neutral-500"
                  >
                    Không có dữ liệu chấm công
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-neutral-50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-4 py-3 text-sm text-neutral-700 whitespace-nowrap"
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-200">
          <p className="text-sm text-neutral-500">
            Hiển thị{' '}
            <span className="font-medium text-neutral-700">
              {data ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, data.total)}` : '0'}
            </span>{' '}
            trong{' '}
            <span className="font-medium text-neutral-700">
              {data?.total.toLocaleString('vi-VN') ?? 0}
            </span>{' '}
            bản ghi
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="btn-secondary px-2 py-1.5 text-xs disabled:opacity-40"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary px-2 py-1.5 text-xs disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-3 py-1.5 text-sm text-neutral-700">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-secondary px-2 py-1.5 text-xs disabled:opacity-40"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
              className="btn-secondary px-2 py-1.5 text-xs disabled:opacity-40"
            >
              »
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
