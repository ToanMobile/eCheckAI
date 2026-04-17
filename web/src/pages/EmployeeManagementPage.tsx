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
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  UserCheck,
  UserX,
  Smartphone,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { RoleBadge } from '@/components/ui/StatusBadge';
import { cn } from '@/lib/utils';
import type {
  Employee,
  Branch,
  UserRole,
  PaginatedResponse,
  EmployeeFilters,
  CreateEmployeeDto,
} from '@/types';

const PER_PAGE = 50;

// ── Schema ──
const createEmployeeSchema = z.object({
  employee_code: z.string().min(1, 'Mã nhân viên không được để trống'),
  full_name: z.string().min(1, 'Họ tên không được để trống'),
  email: z.string().email('Email không đúng định dạng'),
  phone: z.string().optional(),
  role: z.enum(['super_admin', 'hr', 'branch_manager', 'employee']),
  branch_id: z.string().optional(),
  password: z.string().min(8, 'Mật khẩu tối thiểu 8 ký tự'),
});

type CreateEmployeeFormData = z.infer<typeof createEmployeeSchema>;

// ── API ──
async function fetchEmployees(
  filters: EmployeeFilters,
): Promise<PaginatedResponse<Employee>['data']> {
  const params = { ...filters };
  if (params.branch_id === '') delete params.branch_id;
  if (params.search === '') delete params.search;
  
  const { data } = await api.get<PaginatedResponse<Employee>>('/employees', {
    params,
  });
  return data.data;
}

async function fetchBranches(): Promise<Branch[]> {
  const { data } = await api.get<{ data: { items: Branch[] } }>('/branches', {
    params: { limit: 200 },
  });
  return data.data.items;
}

async function createEmployee(dto: CreateEmployeeDto): Promise<Employee> {
  const { data } = await api.post<{ data: Employee }>('/employees', dto);
  return data.data;
}

async function toggleEmployeeStatus(
  id: string,
  is_active: boolean,
): Promise<Employee> {
  const { data } = await api.put<{ data: Employee }>(`/employees/${id}`, {
    is_active,
  });
  return data.data;
}

async function resetDevice(id: string): Promise<Employee> {
  const { data } = await api.post<{ data: Employee }>(
    `/employees/${id}/reset-device`,
  );
  return data.data;
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

// ── Create Employee Dialog ──
function CreateEmployeeDialog({
  branches,
  onClose,
}: {
  branches: Branch[];
  onClose: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateEmployeeFormData>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      role: 'employee',
      employee_code: '',
      full_name: '',
      email: '',
      password: '',
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: CreateEmployeeFormData) => {
      const dto: CreateEmployeeDto = {
        ...data,
        phone: data.phone || undefined,
        branch_id: data.branch_id || undefined,
      };
      return createEmployee(dto);
    },
    onSuccess: () => {
      toast.success('Tạo nhân viên thành công!');
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
      onClose();
    },
    onError: () => toast.error('Tạo thất bại'),
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-employee-title"
    >
      <div className="bg-white rounded-xl shadow-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 sticky top-0 bg-white z-10">
          <h2 id="create-employee-title" className="text-h3">
            Tạo nhân viên mới
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 text-xl leading-none"
            aria-label="Đóng"
          >
            ×
          </button>
        </div>

        <form
          onSubmit={handleSubmit((d) => mutate(d))}
          noValidate
          className="px-6 py-5 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="emp-code" className="label">
                Mã NV <span className="text-danger-base">*</span>
              </label>
              <input
                id="emp-code"
                className={cn('input font-mono', errors.employee_code && 'ring-2 ring-danger-base')}
                placeholder="NV001"
                {...register('employee_code')}
              />
              {errors.employee_code && <p className="field-error">{errors.employee_code.message}</p>}
            </div>

            <div>
              <label htmlFor="emp-phone" className="label">
                Số điện thoại
              </label>
              <input
                id="emp-phone"
                type="tel"
                className="input"
                placeholder="0901234567"
                {...register('phone')}
              />
            </div>
          </div>

          <div>
            <label htmlFor="emp-name" className="label">
              Họ tên <span className="text-danger-base">*</span>
            </label>
            <input
              id="emp-name"
              className={cn('input', errors.full_name && 'ring-2 ring-danger-base')}
              placeholder="Nguyễn Văn A"
              {...register('full_name')}
            />
            {errors.full_name && <p className="field-error">{errors.full_name.message}</p>}
          </div>

          <div>
            <label htmlFor="emp-email" className="label">
              Email <span className="text-danger-base">*</span>
            </label>
            <input
              id="emp-email"
              type="email"
              className={cn('input', errors.email && 'ring-2 ring-danger-base')}
              placeholder="nhanvien@hdbank.vn"
              {...register('email')}
            />
            {errors.email && <p className="field-error">{errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="emp-role" className="label">
                Vai trò <span className="text-danger-base">*</span>
              </label>
              <select
                id="emp-role"
                className="input"
                {...register('role')}
              >
                <option value="employee">Nhân viên</option>
                <option value="branch_manager">Quản lý CN</option>
                <option value="hr">HR</option>
                <option value="super_admin">Super Admin</option>
              </select>
            </div>

            <div>
              <label htmlFor="emp-branch" className="label">
                Chi nhánh
              </label>
              <select
                id="emp-branch"
                className="input"
                {...register('branch_id')}
              >
                <option value="">Chưa gán chi nhánh</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="emp-password" className="label">
              Mật khẩu <span className="text-danger-base">*</span>
            </label>
            <input
              id="emp-password"
              type="password"
              className={cn('input', errors.password && 'ring-2 ring-danger-base')}
              placeholder="Tối thiểu 8 ký tự"
              {...register('password')}
            />
            {errors.password && <p className="field-error">{errors.password.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Hủy
            </button>
            <button type="submit" disabled={isPending} className="btn-primary">
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang tạo...
                </span>
              ) : (
                'Tạo nhân viên'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Row actions ──
function EmployeeActions({
  employee,
}: {
  employee: Employee;
}): JSX.Element {
  const queryClient = useQueryClient();

  const { mutate: toggleStatus, isPending: isToggling } = useMutation({
    mutationFn: () => toggleEmployeeStatus(employee.id, !employee.is_active),
    onSuccess: () => {
      toast.success(
        employee.is_active ? 'Đã vô hoạt hóa tài khoản' : 'Đã koích hoạt tài khoản',
      );
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  const { mutate: doResetDevice, isPending: isResetting } = useMutation({
    mutationFn: () => resetDevice(employee.id),
    onSuccess: () => {
      toast.success('Đã xo00e1 đăng ký thiết bị');
      void queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  return (
    <div className="flex items-center gap-1 justify-end">
      <button
        type="button"
        onClick={() => toggleStatus()}
        disabled={isToggling}
        className={cn(
          'p-1.5 rounded-lg transition-colors',
          employee.is_active
            ? 'text-danger-base hover:bg-danger-bg'
            : 'text-success-base hover:bg-success-bg',
        )}
        title={employee.is_active ? 'Vô hoạt hóa' : 'Koích hoạt'}
        aria-label={
          employee.is_active ? `Vô hoạt hóa ${employee.full_name}` : `Koích hoạt ${employee.full_name}`
        }
      >
        {employee.is_active ? (
          <UserX className="w-4 h-4" aria-hidden="true" />
        ) : (
          <UserCheck className="w-4 h-4" aria-hidden="true" />
        )}
      </button>

      {employee.registered_device_id && (
        <button
          type="button"
          onClick={() => doResetDevice()}
          disabled={isResetting}
          className="p-1.5 rounded-lg text-neutral-400 hover:bg-warning-bg hover:text-warning-text transition-colors"
          title="Xo00f3a đăng ký thiết bị"
          aria-label={`Xóa đăng ký thiết bị của ${employee.full_name}`}
        >
          <Smartphone className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ── Columns ──
function buildColumns(): ColumnDef<Employee>[] {
  return [
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
      accessorKey: 'email',
      header: 'Email',
      size: 200,
    },
    {
      accessorKey: 'branch_name',
      header: 'Chi nhánh',
      cell: ({ getValue }) => (
        <span className="text-neutral-600 text-sm">
          {String(getValue() ?? '—')}
        </span>
      ),
      size: 160,
    },
    {
      accessorKey: 'role',
      header: 'Vai trò',
      cell: ({ getValue }) => <RoleBadge role={String(getValue())} />,
      size: 130,
    },
    {
      id: 'status',
      header: 'Trạng thái',
      cell: ({ row }) => (
        <span
          className={cn(
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
            row.original.is_active
              ? 'bg-success-bg text-success-text'
              : 'bg-neutral-100 text-neutral-500',
          )}
        >
          {row.original.is_active ? 'Hoạt động' : 'Vô hoạt hóa'}
        </span>
      ),
      size: 110,
    },
    {
      id: 'device',
      header: 'Thiết bị',
      cell: ({ row }) => (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-xs',
            row.original.registered_device_id
              ? 'text-neutral-700'
              : 'text-neutral-400',
          )}
        >
          <Smartphone className="w-3.5 h-3.5" aria-hidden="true" />
          {row.original.registered_device_id ? 'Đã đăng ký' : 'Chưa đăng ký'}
        </span>
      ),
      size: 120,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => <EmployeeActions employee={row.original} />,
      size: 80,
    },
  ];
}

// ── Page ──
export function EmployeeManagementPage(): JSX.Element {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<EmployeeFilters>({
    search: '',
    branch_id: '',
    role: undefined,
    is_active: undefined,
  });
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['employees', filters, page],
    queryFn: () =>
      fetchEmployees({ ...filters, page, limit: PER_PAGE }),
    placeholderData: (prev) => prev,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches-options'],
    queryFn: fetchBranches,
    staleTime: 300_000,
  });

  const columns = buildColumns();
  const table = useReactTable({
    data: data?.items ?? [],
    columns,
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
          <h1 className="text-h1">Nhân viên</h1>
          <p className="text-body-sm mt-1">
            {data ? `${data.total.toLocaleString('vi-VN')} nhân viên` : 'Đang tải...'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void refetch()}
            disabled={isFetching}
            className="btn-secondary"
          >
            <RefreshCw
              className={cn('w-4 h-4', isFetching && 'animate-spin')}
              aria-hidden="true"
            />
            Làm mới
          </button>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Tạo nhân viên
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Tìm nhân viên..."
              className="input pl-8"
              value={filters.search ?? ''}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, search: e.target.value }))
              }
              aria-label="Tìm kiếm"
            />
          </div>

          {/* Branch */}
          <select
            className="input"
            value={filters.branch_id ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, branch_id: e.target.value || undefined }))
            }
            aria-label="Chi nhánh"
          >
            <option value="">Tất cả chi nhánh</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          {/* Role */}
          <select
            className="input"
            value={filters.role ?? ''}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, role: (e.target.value as UserRole) || undefined }))
            }
            aria-label="Vai trò"
          >
            <option value="">Tất cả vai trò</option>
            <option value="employee">Nhân viên</option>
            <option value="branch_manager">Quản lý CN</option>
            <option value="hr">HR</option>
            <option value="super_admin">Super Admin</option>
          </select>

          {/* Status */}
          <select
            className="input"
            value={filters.is_active === undefined ? '' : String(filters.is_active)}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                is_active:
                  e.target.value === '' ? undefined : e.target.value === 'true',
              }))
            }
            aria-label="Trạng thái"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="true">Hoạt động</option>
            <option value="false">Vô hoạt hóa</option>
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
                    {columns.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="skeleton h-4 rounded" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-4 py-16 text-center text-sm text-neutral-500"
                  >
                    Không có nhân viên nào
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
              {data
                ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, data.total)}`
                : '0'}
            </span>{' '}
            trong{' '}
            <span className="font-medium text-neutral-700">
              {data?.total.toLocaleString('vi-VN') ?? 0}
            </span>{' '}
            nhân viên
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

      {/* Create dialog */}
      {isCreateOpen && (
        <CreateEmployeeDialog
          branches={branches}
          onClose={() => setIsCreateOpen(false)}
        />
      )}
    </div>
  );
}
