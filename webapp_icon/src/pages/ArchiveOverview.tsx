import { useState, useEffect, useMemo } from 'react';
import { Sidebar } from '../components/Sidebar';
import { listArchive } from '../services/archiveStorage';
import type { ArchiveRecordMeta } from '../services/archiveStorage';

const TYPE_COLORS: Record<string, string> = {
  'Hóa đơn': '#3B82F6',
  'BCTC': '#10B981',
  'Khác': '#F59E0B',
};
const FALLBACK_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
const QUOTA_MB = 100;

const DOT_R = 70;
const DOT_SW = 28;
const C = 2 * Math.PI * DOT_R;

export const ArchiveOverview = () => {
  const [records, setRecords] = useState<ArchiveRecordMeta[]>([]);

  useEffect(() => {
    listArchive().then(setRecords).catch(() => {});
  }, []);

  const totalDocs = records.length;
  const recognized = records.filter(r => r.ocrStatus === 'recognized').length;
  const errors = records.filter(r => r.ocrStatus === 'error').length;
  const pending = records.filter(r => r.ocrStatus === 'pending').length;
  const totalBytes = records.reduce((sum, r) => sum + r.fileSize, 0);
  const totalKB = Math.round(totalBytes / 1024);
  const totalMB = totalBytes / 1024 / 1024;
  const usedPct = Math.min(totalMB / QUOTA_MB, 1);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    records.forEach(r => { counts[r.docType] = (counts[r.docType] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [records]);

  const typeSegments = useMemo(() => {
    let cumPct = 0;
    return typeCounts.map(([type, count], i) => {
      const pct = count / Math.max(totalDocs, 1);
      const dash = pct * C;
      const offset = -cumPct * C;
      cumPct += pct;
      return {
        type, count, pct, dash, offset,
        color: TYPE_COLORS[type] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
      };
    });
  }, [typeCounts, totalDocs]);

  const storageDash = usedPct * C;

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <Sidebar variant="dashboard" />
      <div className="flex-1 flex flex-col gap-6 p-8 px-10 overflow-y-auto">
        <h1 className="text-[28px] font-bold text-[#333]">Kho tài liệu</h1>

        {/* Stats Row */}
        <div className="flex gap-5 w-full">
          {[
            { label: 'Tài liệu', value: totalDocs.toString() },
            { label: 'Đã nhận dạng', value: recognized.toString() },
            { label: 'Lỗi OCR', value: errors.toString() },
            { label: 'KB', value: totalKB.toLocaleString('vi-VN') },
          ].map((stat) => (
            <div key={stat.label} className="flex-1 bg-white rounded-lg p-5 flex flex-col justify-center h-20">
              <span className="text-xl font-bold text-[#333]">{stat.value} <span className="text-sm font-medium text-[#666]">{stat.label}</span></span>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="flex gap-5 flex-1 min-h-0">
          {/* Chart 1 - Loại tài liệu */}
          <div className="flex-1 bg-white rounded-lg p-5 flex flex-col gap-3">
            <span className="text-xs font-bold text-[#333]">THỐNG KÊ LOẠI TÀI LIỆU</span>
            <div className="flex-1 flex items-center justify-center">
              <svg viewBox="0 0 200 200" width="160" height="160">
                {totalDocs === 0 ? (
                  <circle cx="100" cy="100" r={DOT_R} fill="none" stroke="#E5E7EB" strokeWidth={DOT_SW} />
                ) : (
                  typeSegments.map(seg => (
                    <circle
                      key={seg.type}
                      cx="100" cy="100" r={DOT_R}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={DOT_SW}
                      strokeDasharray={`${seg.dash} ${C - seg.dash}`}
                      strokeDashoffset={seg.offset}
                      transform="rotate(-90 100 100)"
                    />
                  ))
                )}
                <circle cx="100" cy="100" r="55" fill="#FFFFFF" />
                <text x="100" y="97" textAnchor="middle" fill="#1E3A8A" fontSize="22" fontWeight="800" fontFamily="Inter">{totalDocs}</text>
                <text x="100" y="112" textAnchor="middle" fill="#9CA3AF" fontSize="10" fontFamily="Inter">tài liệu</text>
              </svg>
            </div>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              {totalDocs === 0 ? (
                <span className="text-[11px] text-[#9CA3AF]">Chưa có dữ liệu</span>
              ) : typeSegments.map(seg => (
                <div key={seg.type} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
                  <span className="text-[11px] text-[#4B5563]">{seg.type}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Chart 2 - Dung lượng */}
          <div className="flex-1 bg-white rounded-lg p-5 flex flex-col gap-3">
            <span className="text-xs font-bold text-[#333]">THỐNG KÊ DUNG LƯỢNG</span>
            <div className="flex-1 flex items-center justify-center">
              <svg viewBox="0 0 200 200" width="160" height="160">
                {/* Track */}
                <circle cx="100" cy="100" r={DOT_R} fill="none" stroke="#FEE2E2" strokeWidth={DOT_SW} />
                {/* Used */}
                {usedPct > 0 && (
                  <circle
                    cx="100" cy="100" r={DOT_R}
                    fill="none"
                    stroke="#EF4444"
                    strokeWidth={DOT_SW}
                    strokeDasharray={`${storageDash} ${C - storageDash}`}
                    strokeDashoffset={0}
                    transform="rotate(-90 100 100)"
                  />
                )}
                <circle cx="100" cy="100" r="55" fill="#FFFFFF" />
                <text x="100" y="94" textAnchor="middle" fill="#991B1B" fontSize="16" fontWeight="800" fontFamily="Inter">{totalMB.toFixed(1)}MB</text>
                <text x="100" y="110" textAnchor="middle" fill="#9CA3AF" fontSize="10" fontFamily="Inter">/ {QUOTA_MB}MB</text>
              </svg>
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                <span className="text-[11px] text-[#4B5563]">Đã sử dụng</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#FEE2E2]" />
                <span className="text-[11px] text-[#9CA3AF]">Còn lại</span>
              </div>
            </div>
          </div>

          {/* Chart 3 - Trạng thái OCR */}
          <div className="flex-1 bg-white rounded-lg p-5 flex flex-col gap-4">
            <span className="text-[11px] font-bold text-[#333]">THỐNG KÊ TRẠNG THÁI OCR</span>
            <div className="flex-1 bg-[#FAFAFA] rounded p-4 flex flex-col justify-center gap-4">
              {[
                { label: 'Đã nhận dạng', count: recognized, color: '#3B82F6' },
                { label: 'Lỗi nhận dạng', count: errors, color: '#EF4444' },
                { label: 'Đang xử lý', count: pending, color: '#F59E0B' },
              ].map(({ label, count, color }) => {
                const pct = totalDocs > 0 ? (count / totalDocs) * 100 : 0;
                return (
                  <div key={label} className="flex flex-col gap-1.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#6B7280]">{label}</span>
                      <span className="font-medium text-[#333]">{count}</span>
                    </div>
                    <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#3B82F6]" />
                <span className="text-[11px] text-[#4B5563]">Đã nhận dạng</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                <span className="text-[11px] text-[#4B5563]">Lỗi</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                <span className="text-[11px] text-[#4B5563]">Đang xử lý</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
