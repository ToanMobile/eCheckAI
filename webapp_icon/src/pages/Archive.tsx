import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { Sidebar } from '../components/Sidebar';
import { listArchive, deleteFromArchive, getArchiveRecord } from '../services/archiveStorage';
import type { ArchiveRecordMeta } from '../services/archiveStorage';
import { useOCR } from '../contexts/OCRContext';
import { Trash2, Download, Eye, Loader2 } from 'lucide-react';
import JSZip from 'jszip';

// Animated progress cell for in-progress OCR
const ProgressCell = ({ startTime }: { startTime: number }) => {
  const [pct, setPct] = useState(() => Math.min(95, Math.round(((Date.now() - startTime) / 10000) * 95)));
  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setPct(Math.min(95, Math.round((elapsed / 10000) * 95)));
    }, 40);
    return () => clearInterval(id);
  }, [startTime]);
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1.5 bg-amber-100 rounded-full overflow-hidden">
        <div className="h-full bg-amber-500 rounded-full transition-all duration-100" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] text-amber-600 w-7 text-right shrink-0">{pct}%</span>
    </div>
  );
};

export const Archive = () => {
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [data, setData] = useState<ArchiveRecordMeta[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  const { fileQueue, docType, processingStartTime } = useOCR();
  const queueFiles = fileQueue.filter(f => f.status === 'processing' || f.status === 'pending');

  // Load archive data on mount
  useEffect(() => {
    loadArchive();
  }, []);

  // Reload archive whenever a new file completes OCR
  const doneCount = fileQueue.filter(f => f.status === 'done').length;
  const prevDoneCount = useRef(0);
  useEffect(() => {
    if (doneCount > prevDoneCount.current) {
      loadArchive();
    }
    prevDoneCount.current = doneCount;
  }, [doneCount]);

  const loadArchive = async () => {
    try {
      setLoading(true);
      const records = await listArchive();
      setData(records);
    } catch (err) {
      console.error('Failed to load archive:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    let result = data;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(row =>
        row.name.toLowerCase().includes(q) ||
        row.date.includes(q) ||
        (row.error && row.error.toLowerCase().includes(q)) ||
        row.docType.toLowerCase().includes(q)
      );
    }
    if (filterType !== 'all') {
      result = result.filter(row => row.ocrStatus === filterType);
    }
    return result;
  }, [data, searchQuery, filterType]);

  // Selection helpers
  const selectableIds = filteredData.map(r => r.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every(id => selectedIds.has(id));
  const someSelected = selectableIds.some(id => selectedIds.has(id));

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        selectableIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleDelete = async (id: string) => {
    try {
      await deleteFromArchive(id);
      setData(prev => prev.filter(row => row.id !== id));
      setSelectedIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (err) {
      console.error('Failed to delete:', err);
    }
    setShowDeleteConfirm(null);
  };

  const handleBulkDownload = async () => {
    const rows = filteredData.filter(r => selectedIds.has(r.id) && r.ocrStatus !== 'pending');
    if (rows.length === 0) return;
    setIsDownloading(true);
    try {
      if (rows.length === 1) {
        // Single file — direct download
        const record = await getArchiveRecord(rows[0].id);
        if (record?.fileBlob) {
          const url = URL.createObjectURL(record.fileBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = record.name;
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        }
      } else {
        // Multiple files — bundle into ZIP (avoids browser multi-download block)
        const zip = new JSZip();
        const records = await Promise.all(rows.map(r => getArchiveRecord(r.id).catch(() => null)));
        records.forEach((record) => {
          if (record?.fileBlob) zip.file(record.name, record.fileBlob);
        });
        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `tai-lieu-${rows.length}-files.zip`;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBulkView = () => {
    const rows = filteredData.filter(r => selectedIds.has(r.id) && r.ocrStatus !== 'pending');
    if (rows.length === 0) return;
    // Navigate to first file; if multiple, pass all IDs so left panel shows all selected files
    const first = rows[0];
    if (rows.length === 1) {
      navigate('/document?id=' + first.id);
    } else {
      navigate('/document?id=' + first.id + '&ids=' + rows.map(r => r.id).join(','));
    }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map(id => deleteFromArchive(id)));
      setData(prev => prev.filter(row => !ids.includes(row.id)));
      clearSelection();
    } catch (err) {
      console.error('Failed to bulk delete:', err);
    }
    setShowBulkDeleteConfirm(false);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleView = (e: React.MouseEvent, row: ArchiveRecordMeta) => {
    e.stopPropagation();
    if (row.ocrStatus === 'pending') {
      showToast('File đang được xử lý, vui lòng đợi trong giây lát!');
      return;
    }
    navigate('/document?id=' + row.id);
  };

  const handleDownload = async (e: React.MouseEvent, row: ArchiveRecordMeta) => {
    e.stopPropagation();
    if (row.ocrStatus === 'pending') {
      showToast('File đang được xử lý, vui lòng đợi trong giây lát!');
      return;
    }
    try {
      const record = await getArchiveRecord(row.id);
      if (record?.fileBlob) {
        const url = URL.createObjectURL(record.fileBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = row.name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      showToast('Không thể tải file');
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setShowDeleteConfirm(id);
  };

  const filterLabels: Record<string, string> = {
    all: 'Tất cả',
    recognized: 'Đã nhận dạng',
    error: 'Lỗi nhận dạng',
    pending: 'Đang xử lý',
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <Sidebar variant="dashboard" />
      <div className="flex-1 flex flex-col gap-6 py-8 px-10 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="flex gap-2 text-[13px]">
          <span className="text-[#0B57D0] cursor-pointer" onClick={() => navigate('/dashboard')}>Tổng quan</span>
          <span className="text-[#999]">&gt;</span>
          <span className="text-[#666]">Kho lưu trữ</span>
        </div>

        {/* Page Title */}
        <h1 className="text-2xl font-bold text-[#1F1F1F]">Kho lưu trữ</h1>

        {/* Toolbar */}
        <div className="flex justify-between items-center w-full">
          <div className="flex gap-3 items-center">
            <input
              type="text"
              placeholder="Tìm kiếm nhanh"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
              className="h-9 w-[200px] rounded-md border border-[#D1D5DB] px-3 text-[13px] text-[#333] placeholder-[#BFBFBF] outline-none focus:border-[#0B57D0] focus:ring-1 focus:ring-[#0B57D0]"
            />
            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="h-9 rounded-md border border-[#D1D5DB] px-3 flex items-center gap-2 cursor-pointer hover:bg-gray-50"
              >
                <span className="text-[13px] text-[#666]">Lọc</span>
                <span className="material-symbols-rounded text-[#666] text-sm">filter_list</span>
              </button>
              {showFilterDropdown && (
                <div
                  className="absolute top-full left-0 mt-1 bg-white rounded-lg border border-gray-200 py-1 z-10 min-w-[160px]"
                  style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                  {Object.entries(filterLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setFilterType(key); setShowFilterDropdown(false); }}
                      className={`w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 ${filterType === key ? 'text-[#0B57D0] font-medium bg-blue-50' : 'text-[#333]'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => setSearchQuery('')}
              className="h-9 bg-[#0B57D0] text-white text-[13px] font-medium px-4 rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-blue-700"
              style={{ boxShadow: '0 4px 12px rgba(11,87,208,0.25)' }}
            >
              Tìm kiếm
            </button>
          </div>

          <div className="flex gap-3 items-center">
            <div className="relative">
              <div
                onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 cursor-pointer hover:bg-gray-50"
                style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
              >
                <span className="text-[13px] font-medium text-[#5E5E5E]">Trạng thái:</span>
                <span className="text-[13px] font-medium text-[#1F1F1F]">{filterLabels[filterType]}</span>
                <span className="material-symbols-rounded text-[#5E5E5E] text-base">arrow_drop_down</span>
              </div>
              {showTypeDropdown && (
                <div
                  className="absolute top-full right-0 mt-1 bg-white rounded-lg border border-gray-200 py-1 z-10 min-w-[160px]"
                  style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                  {Object.entries(filterLabels).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => { setFilterType(key); setShowTypeDropdown(false); }}
                      className={`w-full text-left px-4 py-2 text-[13px] hover:bg-gray-50 ${filterType === key ? 'text-[#0B57D0] font-medium bg-blue-50' : 'text-[#333]'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => navigate('/document')}
              className="h-9 bg-[#0B57D0] text-white text-[13px] font-medium px-4 rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-blue-700"
              style={{ boxShadow: '0 4px 12px rgba(11,87,208,0.25)' }}
            >
              OCR tài liệu mới
            </button>
          </div>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg">
            <span className="text-[13px] text-[#0B57D0] font-semibold shrink-0">
              Đã chọn {selectedIds.size} tài liệu
            </span>
            <div className="w-px h-4 bg-blue-200 shrink-0" />
            <button
              onClick={handleBulkView}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#0B57D0] text-white text-[13px] font-medium hover:bg-blue-700 transition-colors"
            >
              <Eye size={14} />
              Xem
            </button>
            <button
              onClick={handleBulkDownload}
              disabled={isDownloading}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#0B57D0] text-white text-[13px] font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-wait"
            >
              {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {isDownloading ? 'Đang tạo ZIP...' : selectedIds.size > 1 ? 'Tải về (ZIP)' : 'Tải về'}
            </button>
            <button
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-red-500 text-white text-[13px] font-medium hover:bg-red-600 transition-colors"
            >
              <Trash2 size={14} />
              Xóa
            </button>
            <button
              onClick={clearSelection}
              className="h-8 px-3 rounded-lg border border-blue-300 text-[13px] text-[#0B57D0] hover:bg-blue-100 transition-colors ml-auto"
            >
              Bỏ chọn
            </button>
          </div>
        )}

        {/* Data Table */}
        <div className="bg-white rounded-lg flex-1 flex flex-col overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center gap-2 pr-4 py-3 bg-[#FAFAFA]">
            <div className="w-[72px] flex items-center gap-2 pl-4 cursor-pointer self-stretch" onClick={toggleSelectAll}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
                onChange={() => {}}
                className="w-4 h-4 accent-[#0B57D0] cursor-pointer shrink-0"
              />
              <span className="text-xs font-bold text-[#666]">STT</span>
            </div>
            <div className="flex-1 text-xs font-bold text-[#666]">TÊN</div>
            <div className="w-[120px] text-xs font-bold text-[#666]">LOẠI</div>
            <div className="w-[100px] text-xs font-bold text-[#666]">DUNG LƯỢNG</div>
            <div className="w-[120px] text-xs font-bold text-[#666]">TRẠNG THÁI OCR</div>
            <div className="flex-1 text-xs font-bold text-[#666] min-w-[150px]">CHI TIẾT LỖI</div>
            <div className="w-[80px] text-xs font-bold text-[#666]">THAO TÁC</div>
          </div>

          {/* Table Body */}
          <div className="flex-1 overflow-y-auto divide-y divide-[#F0F0F0]">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-sm text-gray-400">
                Đang tải dữ liệu...
              </div>
            ) : filteredData.length === 0 && queueFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <span className="text-sm text-gray-400">
                  {data.length === 0 ? 'Chưa có tài liệu nào trong kho lưu trữ' : 'Không tìm thấy tài liệu nào'}
                </span>
                {data.length === 0 && (
                  <button
                    onClick={() => navigate('/document')}
                    className="text-sm text-[#0B57D0] hover:underline cursor-pointer"
                  >
                    OCR tài liệu đầu tiên
                  </button>
                )}
              </div>
            ) : (
              <>
              {/* In-progress queue files at the top */}
              {queueFiles.map(qf => {
                const docTypeLabel = docType === 'invoice' ? 'Hóa đơn' : docType === 'financial_report' ? 'BCTC' : 'Khác';
                return (
                  <div key={qf.id} className="flex items-center gap-2 pr-4 py-3.5 bg-amber-50/50 border-b border-amber-100">
                    <div className="w-[72px] pl-4 shrink-0" />

                    <div className="flex-1 flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-[#333]">{qf.name}</span>
                      <span className="text-[11px] text-[#999]">Đang trong hàng chờ OCR</span>
                    </div>
                    <div className="w-[120px] text-[13px] text-[#999]">{docTypeLabel}</div>
                    <div className="w-[100px] text-[13px] text-[#999]">{(qf.size / 1024 / 1024).toFixed(2)} MB</div>
                    <div className="w-[120px] flex items-center">
                      {qf.status === 'processing' && processingStartTime != null
                        ? <ProgressCell startTime={processingStartTime} />
                        : <span className="text-[11px] text-gray-400">Chờ xử lý</span>
                      }
                    </div>
                    <div className="flex-1 min-w-[150px]" />
                    <div className="w-[80px]" />
                  </div>
                );
              })}
              {filteredData.map((row, index) => {
                const isSelected = selectedIds.has(row.id);
                return (
                  <div
                    key={row.id}
                    className={`flex items-center gap-2 pr-4 py-3.5 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-[#FAFAFA]'}`}
                    onClick={() => navigate('/document?id=' + row.id)}
                  >
                    <div className="w-[72px] flex items-center gap-2 pl-4 cursor-pointer shrink-0 self-stretch" onClick={e => toggleSelect(row.id, e)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 accent-[#0B57D0] cursor-pointer shrink-0"
                      />
                      <span className="text-[13px] text-[#333]">{index + 1}</span>
                    </div>
                    <div className="flex-1 flex flex-col gap-0.5">
                      <span className="text-[13px] font-medium text-[#0B57D0]">{row.name}</span>
                      <span className="text-[11px] text-[#999]">{row.date}</span>
                    </div>
                    <div className="w-[120px] text-[13px] text-[#333]">
                      {row.docType}
                    </div>
                    <div className="w-[100px] text-[13px] text-[#999]">
                      {(row.fileSize / 1024 / 1024).toFixed(2)} MB
                    </div>
                    <div className="w-[120px]">
                      {row.ocrStatus === 'recognized' && (
                        <div className="h-[26px] rounded bg-[#E6F4FF] flex items-center justify-center">
                          <span className="text-xs text-[#0B57D0]">Đã nhận dạng</span>
                        </div>
                      )}
                      {row.ocrStatus === 'error' && (
                        <div className="h-[26px] rounded bg-[#FFF1F0] flex items-center justify-center">
                          <span className="text-xs text-[#CF1322]">Lỗi nhận dạng</span>
                        </div>
                      )}
                      {row.ocrStatus === 'pending' && (
                        <div className="h-[26px] rounded bg-[#FFF7E6] flex items-center justify-center">
                          <span className="text-xs text-[#D46B08]">Đang xử lý</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-[150px]">
                      {row.ocrStatus === 'error' && row.error && (
                        <span className="text-[11px] text-[#CF1322] line-clamp-2" title={row.error}>
                          {row.error}
                        </span>
                      )}
                    </div>
                    <div className="w-[80px] flex gap-1">
                      <button
                        onClick={(e) => handleView(e, row)}
                        className="p-1.5 rounded hover:bg-blue-50 text-[#666] hover:text-[#0B57D0] transition-colors cursor-pointer"
                        title="Xem file gốc"
                      >
                        <span className="material-symbols-rounded text-lg">visibility</span>
                      </button>
                      <button
                        onClick={(e) => handleDownload(e, row)}
                        className="p-1.5 rounded hover:bg-blue-50 text-[#666] hover:text-[#0B57D0] transition-colors cursor-pointer"
                        title="Tải xuống"
                      >
                        <span className="material-symbols-rounded text-lg">download</span>
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(e, row.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-[#666] hover:text-[#CF1322] transition-colors cursor-pointer"
                        title="Xóa"
                      >
                        <span className="material-symbols-rounded text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#F0F0F0] text-[12px] text-[#999]">
            Tổng số có {filteredData.length} tài liệu
            {selectedIds.size > 0 && (
              <span className="ml-2 text-[#0B57D0] font-medium">· Đang chọn {selectedIds.size}</span>
            )}
          </div>
        </div>

        {/* Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 inset-x-0 z-50 flex justify-center pointer-events-none">
            <div className="bg-[#1F1F1F] text-white text-sm px-5 py-3 rounded-xl shadow-lg flex items-center gap-2 pointer-events-auto">
              <span className="text-amber-400">⚠</span>
              {toastMessage}
            </div>
          </div>
        )}

        {/* Single Delete Confirmation Dialog */}
        <Modal
          isOpen={showDeleteConfirm !== null}
          onClose={() => setShowDeleteConfirm(null)}
          title="Xác nhận xóa"
          width={400}
          footer={
            <>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="h-10 px-6 rounded-lg bg-white text-[#374151] text-sm font-semibold cursor-pointer"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                Hủy
              </button>
              <button
                onClick={() => showDeleteConfirm !== null && handleDelete(showDeleteConfirm)}
                className="h-10 px-6 rounded-lg bg-[#EF4444] text-white text-sm font-semibold cursor-pointer"
                style={{ boxShadow: '0 4px 12px rgba(239,68,68,0.25)' }}
              >
                Xóa
              </button>
            </>
          }
        >
          <div className="flex flex-col items-center gap-2 text-center py-4">
            <p className="text-sm text-[#4B5563]">Bạn có chắc chắn muốn xóa tài liệu này?</p>
            <p className="text-sm text-[#9CA3AF]">Hành động này không thể hoàn tác.</p>
          </div>
        </Modal>

        {/* Bulk Delete Confirmation Dialog */}
        <Modal
          isOpen={showBulkDeleteConfirm}
          onClose={() => setShowBulkDeleteConfirm(false)}
          title="Xác nhận xóa hàng loạt"
          width={400}
          footer={
            <>
              <button
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="h-10 px-6 rounded-lg bg-white text-[#374151] text-sm font-semibold cursor-pointer"
                style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
              >
                Hủy
              </button>
              <button
                onClick={handleBulkDelete}
                className="h-10 px-6 rounded-lg bg-[#EF4444] text-white text-sm font-semibold cursor-pointer"
                style={{ boxShadow: '0 4px 12px rgba(239,68,68,0.25)' }}
              >
                Xóa {selectedIds.size} tài liệu
              </button>
            </>
          }
        >
          <div className="flex flex-col items-center gap-2 text-center py-4">
            <p className="text-sm text-[#4B5563]">
              Bạn có chắc chắn muốn xóa <span className="font-semibold text-[#1F1F1F]">{selectedIds.size} tài liệu</span> đã chọn?
            </p>
            <p className="text-sm text-[#9CA3AF]">Hành động này không thể hoàn tác.</p>
          </div>
        </Modal>
      </div>
    </div>
  );
};
