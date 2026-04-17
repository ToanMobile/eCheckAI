import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Clock,
  Edit2,
  Save,
  Plus,
  CheckSquare,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Schedule, Branch, CreateScheduleDto, WeekDay } from '@/types';

// ── Days config ──
const WEEK_DAYS: { value: WeekDay; label: string; short: string }[] = [
  { value: 1, label: 'Thứ Hai', short: 'T2' },
  { value: 2, label: 'Thứ Ba', short: 'T3' },
  { value: 3, label: 'Thứ Tư', short: 'T4' },
  { value: 4, label: 'Thứ Năm', short: 'T5' },
  { value: 5, label: 'Thứ Sáu', short: 'T6' },
  { value: 6, label: 'Thứ Bảy', short: 'T7' },
  { value: 0, label: 'Chủ Nhật', short: 'CN' },
];

// ── Schema ──
const scheduleSchema = z.object({
  checkin_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ không hợp lệ (HH:mm)'),
  checkout_time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ không hợp lệ (HH:mm)'),
  window_minutes: z
    .number({ invalid_type_error: 'Cầu vắc số phút' })
    .min(1, 'Tối thiểu 1 phút')
    .max(120, 'Tối đa 120 phút'),
  active_days: z
    .array(z.number())
    .min(1, 'Phải chọn ít nhất 1 ngày'),
  is_active: z.boolean(),
});

type ScheduleFormData = z.infer<typeof scheduleSchema>;

// ── API ──
async function fetchSchedules(): Promise<Schedule[]> {
  const { data } = await api.get<{ data: { items: Schedule[] } }>(
    '/schedules',
    { params: { per_page: 200 } },
  );
  return data.data.items;
}

async function fetchBranches(): Promise<Branch[]> {
  const { data } = await api.get<{ data: { items: Branch[] } }>('/branches', {
    params: { per_page: 200 },
  });
  return data.data.items;
}

async function createSchedule(dto: CreateScheduleDto): Promise<Schedule> {
  const { data } = await api.post<{ data: Schedule }>('/schedules', dto);
  return data.data;
}

async function updateSchedule(
  id: string,
  dto: Partial<CreateScheduleDto>,
): Promise<Schedule> {
  const { data } = await api.put<{ data: Schedule }>(`/schedules/${id}`, dto);
  return data.data;
}

// ── Day selector ──
function DaySelector({
  value,
  onChange,
  error,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  error?: string;
}): JSX.Element {
  function toggle(day: WeekDay): void {
    if (value.includes(day)) {
      onChange(value.filter((d) => d !== day));
    } else {
      onChange([...value, day]);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {WEEK_DAYS.map(({ value: day, short, label }) => {
          const isSelected = value.includes(day);
          return (
            <button
              key={day}
              type="button"
              onClick={() => toggle(day)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
                isSelected
                  ? 'bg-primary-50 text-primary-700 border-primary-300'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300',
              )}
              aria-pressed={isSelected}
              aria-label={label}
            >
              {isSelected ? (
                <CheckSquare
                  className="w-3.5 h-3.5 text-primary-600"
                  aria-hidden="true"
                />
              ) : (
                <Square className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {short}
            </button>
          );
        })}
      </div>
      {error && <p className="field-error mt-1">{error}</p>}
    </div>
  );
}

// ── Schedule card ──
function ScheduleCard({
  schedule,
  onEdit,
}: {
  schedule: Schedule;
  onEdit: () => void;
}): JSX.Element {
  const activeDayLabels = WEEK_DAYS.filter((d) =>
    schedule.active_days.includes(d.value),
  ).map((d) => d.short);

  return (
    <div className="card p-5 hover:shadow-md transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-neutral-950">
            {schedule.branch_name}
          </h3>
          {!schedule.is_active && (
            <span className="text-xs text-neutral-400">
              Không hoạt động
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-primary-600 transition-colors"
          aria-label="Chỉnh sửa lịch ca"
        >
          <Edit2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="bg-neutral-50 rounded-lg px-3 py-2">
          <p className="text-xs text-neutral-500 mb-0.5">Giờ vào</p>
          <p className="font-mono text-base font-semibold text-neutral-950">
            {schedule.checkin_time}
          </p>
        </div>
        <div className="bg-neutral-50 rounded-lg px-3 py-2">
          <p className="text-xs text-neutral-500 mb-0.5">Giờ ra</p>
          <p className="font-mono text-base font-semibold text-neutral-950">
            {schedule.checkout_time}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {activeDayLabels.map((d) => (
            <span
              key={d}
              className="px-1.5 py-0.5 text-[10px] font-semibold bg-primary-50 text-primary-700 rounded"
            >
              {d}
            </span>
          ))}
        </div>
        <span className="text-xs text-neutral-500">
          Cửa sổ ±{schedule.window_minutes} phút
        </span>
      </div>
    </div>
  );
}

// ── Schedule edit modal ──
function ScheduleModal({
  schedule,
  branches,
  onClose,
}: {
  schedule: Schedule | null;
  branches: Branch[];
  onClose: () => void;
}): JSX.Element {
  const queryClient = useQueryClient();
  const isNew = !schedule;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isDirty },
  } = useForm<ScheduleFormData>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      checkin_time: schedule?.checkin_time ?? '08:00',
      checkout_time: schedule?.checkout_time ?? '17:30',
      window_minutes: schedule?.window_minutes ?? 15,
      active_days: schedule?.active_days ?? [1, 2, 3, 4, 5],
      is_active: schedule?.is_active ?? true,
    },
  });

  const [selectedBranchId, setSelectedBranchId] = useState(
    schedule?.branch_id ?? '',
  );

  const { mutate, isPending } = useMutation({
    mutationFn: async (data: ScheduleFormData) => {
      const dto: CreateScheduleDto = {
        ...data,
        branch_id: selectedBranchId,
        active_days: data.active_days as WeekDay[],
      };
      if (isNew) return createSchedule(dto);
      return updateSchedule(schedule.id, dto);
    },
    onSuccess: () => {
      toast.success(
        isNew ? 'Tạo lịch ca thành công!' : 'Cập nhật thành công!',
      );
      void queryClient.invalidateQueries({ queryKey: ['schedules'] });
      onClose();
    },
    onError: () => toast.error('Lưu thất bại'),
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-lg w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 id="schedule-modal-title" className="text-h3">
            {isNew ? 'Tạo lịch ca' : 'Chỉnh sửa lịch ca'}
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
          {/* Branch selector (only for new) */}
          {isNew && (
            <div>
              <label htmlFor="branch_select" className="label">
                Chi nhánh <span className="text-danger-base">*</span>
              </label>
              <select
                id="branch_select"
                className="input"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
              >
                <option value="">Chọn chi nhánh...</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Checkin time */}
            <div>
              <label htmlFor="checkin_time" className="label">
                Giờ vào <span className="text-danger-base">*</span>
              </label>
              <input
                id="checkin_time"
                type="time"
                className={cn(
                  'input font-mono',
                  errors.checkin_time && 'ring-2 ring-danger-base',
                )}
                {...register('checkin_time')}
              />
              {errors.checkin_time && (
                <p className="field-error">{errors.checkin_time.message}</p>
              )}
            </div>

            {/* Checkout time */}
            <div>
              <label htmlFor="checkout_time" className="label">
                Giờ ra <span className="text-danger-base">*</span>
              </label>
              <input
                id="checkout_time"
                type="time"
                className={cn(
                  'input font-mono',
                  errors.checkout_time && 'ring-2 ring-danger-base',
                )}
                {...register('checkout_time')}
              />
              {errors.checkout_time && (
                <p className="field-error">{errors.checkout_time.message}</p>
              )}
            </div>
          </div>

          {/* Window minutes */}
          <div>
            <label htmlFor="window_minutes" className="label">
              Cửa sổ cho phép (phút)
            </label>
            <input
              id="window_minutes"
              type="number"
              min={1}
              max={120}
              className={cn(
                'input w-28',
                errors.window_minutes && 'ring-2 ring-danger-base',
              )}
              {...register('window_minutes', { valueAsNumber: true })}
            />
            {errors.window_minutes && (
              <p className="field-error">{errors.window_minutes.message}</p>
            )}
          </div>

          {/* Active days */}
          <div>
            <p className="label mb-2">
              Ngày hoạt động <span className="text-danger-base">*</span>
            </p>
            <Controller
              name="active_days"
              control={control}
              render={({ field }) => (
                <DaySelector
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.active_days?.message}
                />
              )}
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending || (!isDirty && !isNew)}
              className="btn-primary"
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang lưu...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Save className="w-4 h-4" aria-hidden="true" />
                  Lưu
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Page ──
export function ScheduleConfigPage(): JSX.Element {
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null | undefined>(undefined);

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['schedules'],
    queryFn: fetchSchedules,
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: fetchBranches,
  });

  const isModalOpen = editingSchedule !== undefined;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="text-h1">Cấu hình lịch ca</h1>
          <p className="text-body-sm mt-1">
            {schedules.length} lịch ca
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditingSchedule(null)}
          className="btn-primary"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Tạo lịch ca
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5">
              <div className="skeleton h-5 w-40 rounded mb-3" />
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="skeleton h-16 rounded-lg" />
                <div className="skeleton h-16 rounded-lg" />
              </div>
              <div className="skeleton h-4 w-32 rounded" />
            </div>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Clock
            className="w-12 h-12 text-neutral-300 mb-4"
            aria-hidden="true"
          />
          <p className="text-neutral-500 mb-4">Chưa có lịch ca nào</p>
          <button
            type="button"
            onClick={() => setEditingSchedule(null)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            Tạo lịch ca đầu tiên
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {schedules.map((s) => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              onEdit={() => setEditingSchedule(s)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <ScheduleModal
          schedule={editingSchedule}
          branches={branches}
          onClose={() => setEditingSchedule(undefined)}
        />
      )}
    </div>
  );
}
