import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef,
  flexRender,
} from '@tanstack/react-table';
import {
  ShieldAlert,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  CheckCircle2,
  Monitor,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { SeverityBadge } from '@/components/ui/StatusBadge';
import { cn, formatDatetime } from '@/lib/utils';
import type {
  FraudLog,
  FraudSeverity,
  FraudType,
  FraudFilters,
  PaginatedResponse,
} from '@/types';

const PER_PAGE = 50;

const SEVERITY_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả mức độ' },
  { value: 'critical', label: 'Nghưỡm trọng' },
  { value: 'high', label: 'Cao' },
  { value: 'medium', label: 'Trung bình' },
  { value: 'low', label: 'Thấp' },
];

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tất cả loại' },
  { value: 'DEVICE_MISMATCH', label: 'Sai thiết bị' },
  { value: 'VPN_DETECTED', label: 'Dùng VPN' },
  { value: 'MOCK_LOCATION', label: 'Giả vị trí' },
  { value: 'OUTSIDE_GEOFENCE', label: 'Ngoài vùng' },
  { value: 'WIFI_MISMATCH', label: 'Sai WiFi' },
  { value: 'OUTSIDE_SCHEDULE', label: 'Ngoài giờ' },
  { value: 'RATE_LIMIT_EXCEEDED', label: 'Vượt giới hạn' },
  { value: 'GPS_INACCURATE', label: 'GPS không chính xác' },
];

// ── API ──
async function fetchFraudLogs(
  filters: FraudFilters,
): Promise<PaginatedResponse<FraudLog>['data']> {
  const { data } = await api.get<PaginatedResponse<FraudLog>>('/fraud/logs', {
    params: filters,
  });
  return data.data;
}

async function resolveFraud(
  id: string,
  note: string,
): Promise<FraudLog> {
  const { data } = await api.patch<{ data: FraudLog }>(
    `/fraud/logs/${id}/resolve`,
    { resolution_note: note },
  );
  return data.data;
}

// ── Detail Modal ──
function FraudDetailModal({
  fraud,
  onClose,
}: {
  fraud: FraudLog;
  onClose: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [resolutionNote, setResolutionNote] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: () => resolveFraud(fraud.id, resolutionNote),
    onSuccess: () => {
      toast.success('Đã xử lý báo cáo gian lận');
      void queryClient.invalidateQueries({ queryKey: ['fraud-logs'] });
      onClose();
    },
    onError: () => toast.error('Xử lý thất bại'),
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fraud-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-2xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
          <div className="flex items-center gap-3">
            <ShieldAlert
              className="w-5 h-5 text-danger-base"
              aria-hidden="true"
            />
            <div>
              <h2 id="fraud-modal-title" className="text-base font-semibold text-neutral-950">
                Chi tiết gian lận
              </h2>
              <p className="text-xs text-neutral-500">
                {fraud.full_name} — {fraud.branch_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Summary */}
          <div className="flex flex-wrap gap-3">
            <SeverityBadge severity={fraud.severity} />
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
              {fraud.type}
            </span>
            {fraud.is_resolved && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-bg text-success-text">
                <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                Đã xử lý
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-neutral-50 rounded-lg p-3">
              <p className="text-xs text-neutral-500 mb-0.5">Nhân viên</p>
              <p className="text-sm font-medium">{fraud.full_name}</p>
              <p className="font-mono text-xs text-neutral-500">
                {fraud.employee_code}
              </p>
            </div>
            <div className="bg-neutral-50 rounded-lg p-3">
              <p className="text-xs text-neutral-500 mb-0.5">Thời gian</p>
              <p className="font-mono text-sm">
                {formatDatetime(fraud.created_at)}
              </p>
            </div>
          </div>

          {/* Device snapshot */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Monitor
                className="w-4 h-4 text-neutral-500"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold text-neutral-950">
                Thông tin thiết bị
              </h3>
            </div>
            <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
              {Object.entries(fraud.device_snapshot).map(([key, val]) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <span className="text-xs text-neutral-500 min-w-[140px] shrink-0">
                    {key}
                  </span>
                  <span
                    className={cn(
                      'font-mono text-xs text-right break-all',
                      (key === 'is_vpn_active' || key === 'is_mock_location') &&
                        val === true
                        ? 'text-danger-base font-semibold'
                        : 'text-neutral-700',
                    )}
                  >
                    {String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Location snapshot */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MapPin
                className="w-4 h-4 text-neutral-500"
                aria-hidden="true"
              />
              <h3 className="text-sm font-semibold text-neutral-950">
                Thông tin vị trí
              </h3>
            </div>
            <div className="bg-neutral-50 rounded-lg p-4 space-y-2">
              {Object.entries(fraud.location_snapshot).map(([key, val]) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <span className="text-xs text-neutral-500 min-w-[140px] shrink-0">
                    {key}
                  </span>
                  <span className="font-mono text-xs text-neutral-700 text-right break-all">
                    {val !== null ? String(val) : 'null'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* IP */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">IP Address:</span>
            <span className="font-mono text-xs text-neutral-700">
              {fraud.client_ip}
            </span>
          </div>

          {/* Resolution note */}
          {!fraud.is_resolved && (
            <div>
              <label htmlFor="resolution-note" className="label">
                Ghi chú xử lý
              </label>
              <textarea
                id="resolution-note"
                className="input resize-none"
                rows={3}
                placeholder="Moô tả nội dung xử lý..."
                value={resolutionNote}
                onChange={(e) => setResolutionNote(e.target.value)}
              />
            </div>
          )}

          {/* Resolved info */}
          {fraud.is_resolved && (
            <div className="bg-success-bg border border-success-base/20 rounded-lg p-4">
              <p className="text-xs font-medium text-success-text mb-1">
                Đã xử lý bởi {fraud.resolved_by} lúc{' '}
                {fraud.resolved_at ? formatDatetime(fraud.resolved_at) : 'N/A'}
              </p>
              {fraud.resolution_note && (
                <p className="text-sm text-success-text">{fraud.resolution_note}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!fraud.is_resolved && (
          <div className="px-6 py-4 border-t border-neutral-200 shrink-0 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Đóng
            </button>
            <button
              type="button"
              onClick={() => mutate()}
              disabled={isPending}
              className="btn-primary"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                  Xác nhận đã xử lý
                </span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sort header ──
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

// ── Columns ──
const FRAUD_COLUMNS: ColumnDef<FraudLog>[] = [
  {
    accessorKey: 'severity',
    header: 'Mức độ',
    cell: ({ getValue }) => (
      <SeverityBadge severity={getValue() as FraudSeverity} />
    ),
    size: 120,
  },
  {
    accessorKey: 'employee_code',
    header: 'Mã NV',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs">{String(getValue())}</span>
    ),
    size: 90,
  },
  {
    accessorKey: 'full_name',
    header: 'Họ tên',
    cell: ({ getValue }) => (
      <span className="font-medium">{String(getValue())}</span>
    ),
    size: 160,
  },
  {
    accessorKey: 'branch_name',
    header: 'Chi nhánh',
    size: 150,
  },
  {
    accessorKey: 'type',
    header: 'Loại',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded text-neutral-700">
        {String(getValue())}
      </span>
    ),
    size: 160,
  },
  {
    accessorKey: 'created_at',
    header: 'Thời gian',
    cell: ({ getValue }) => (
      <span className="font-mono text-xs text-neutral-600">
        {formatDatetime(String(getValue()))}
      </span>
    ),
    size: 150,
  },
  {
    accessorKey: 'is_resolved',
    header: 'Trạng thái',
    cell: ({ getValue }) => (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
          getValue()
            ? 'bg-success-bg text-success-text'
            : 'bg-warning-bg text-warning-text',
        )}
      >
        {getValue() ? (
          <>
            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
            Đã xử lý
          </>
        ) : (
          'Chưa xử lý'
        )}
      </span>
    ),
    size: 110,
  },
];

// ── Page ──
export function FraudLogsPage(): JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'severity', desc: false }, // critical first (alphabetical: critical < high < low < medium)
  ]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<FraudFilters>({});
  const [selectedFraud, setSelectedFraud] = useState<FraudLog | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['fraud-logs', filters, page],
    queryFn: () =>
      fetchFraudLogs({ ...filters, page, limit: PER_PAGE }),
    placeholderData: (prev) => prev,
  });

  const table = useReactTable({
    data: data?.items ?? [],
    columns: FRAUD_COLUMNS,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: data?.totalPages ?? 1,
  });

  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="text-h1">Phát hiện gian lận</h1>
          <p className="text-body-sm mt-1">
            {data ? `${data.total.toLocaleString('vi-VN')} báo cáo` : 'Đang tải...'}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {/* Severity */}
          <select
            className="input"
            value={filters.severity ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                severity: (e.target.value as FraudSeverity) || undefined,
              }))
            }
            aria-label="Mức độ"
          >
            {SEVERITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Type */}
          <select
            className="input"
            value={filters.type ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                type: (e.target.value as FraudType) || undefined,
              }))
            }
            aria-label="Loại gian lận"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Date from */}
          <input
            type="date"
            className="input"
            value={filters.date_from ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                date_from: e.target.value || undefined,
              }))
            }
            aria-label="Từ ngày"
          />

          {/* Date to */}
          <input
            type="date"
            className="input"
            value={filters.date_to ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                date_to: e.target.value || undefined,
              }))
            }
            aria-label="Đến ngày"
          />

          {/* Resolved */}
          <select
            className="input"
            value={filters.is_resolved === undefined ? '' : String(filters.is_resolved)}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                is_resolved:
                  e.target.value === '' ? undefined : e.target.value === 'true',
              }))
            }
            aria-label="Trạng thái xử lý"
          >
            <option value="">Tất cả</option>
            <option value="false">Chưa xử lý</option>
            <option value="true">Đã xử lý</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              {table.getHeaderGroups().map((hg) => (
                <tr
                  key={hg.id}
                  className="border-b border-neutral-200 bg-neutral-50"
                >
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
                          onClick={
                            header.column.getToggleSortingHandler() ?? ((_e: unknown) => {})
                          }
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
                    {FRAUD_COLUMNS.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={FRAUD_COLUMNS.length}
                    className="px-4 py-16 text-center text-sm text-neutral-500"
                  >
                    Không có báo cáo gian lận
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-neutral-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedFraud(row.original)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedFraud(row.original);
                      }
                    }}
                    aria-label={`Xem chi tiết: ${row.original.full_name} — ${row.original.type}`}
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
            {data
              ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, data.total)} trong ${data.total.toLocaleString('vi-VN')}`
              : '0'}
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

      {/* Detail modal */}
      {selectedFraud && (
        <FraudDetailModal
          fraud={selectedFraud}
          onClose={() => setSelectedFraud(null)}
        />
      )}
    </div>
  );
}
