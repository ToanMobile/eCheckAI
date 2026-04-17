import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { getArchiveRecord } from '../services/archiveStorage';
import type { ArchiveRecord } from '../services/archiveStorage';

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export const DocumentDetail = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [record, setRecord] = useState<ArchiveRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);

  useEffect(() => {
    if (!id) return;
    loadRecord(id);
  }, [id]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  const loadRecord = async (docId: string) => {
    try {
      setLoading(true);
      const rec = await getArchiveRecord(docId);
      setRecord(rec);
      if (rec?.fileBlob) {
        setFileUrl(URL.createObjectURL(rec.fileBlob));
      }
    } catch (err) {
      console.error('Failed to load document:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!record?.fileBlob) return;
    const url = URL.createObjectURL(record.fileBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = record.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const isPdf = record?.fileMimeType === 'application/pdf';

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full">
        <p className="text-sm text-gray-400">Đang tải tài liệu...</p>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-4">
        <p className="text-sm text-gray-500">Không tìm thấy tài liệu</p>
        <button
          onClick={() => navigate('/archive')}
          className="text-sm text-[#0B57D0] hover:underline cursor-pointer"
        >
          Quay lại kho lưu trữ
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full overflow-hidden bg-[#F3F4F6]">
      {/* Left - File Preview */}
      <div className="w-[40%] shrink-0 flex flex-col h-full overflow-hidden">
        {/* Toolbar */}
        <div className="h-10 bg-[#0B57D0] flex items-center justify-between px-5 shrink-0">
          <span className="text-xs text-white truncate max-w-[70%]">{record.name}</span>
          <div className="flex items-center gap-3">
            {isPdf && numPages > 0 && (
              <span className="text-xs text-white/80">{numPages} trang</span>
            )}
            <button
              onClick={handleDownload}
              className="text-white/80 hover:text-white cursor-pointer"
              title="Tải xuống"
            >
              <span className="material-symbols-rounded text-base">download</span>
            </button>
          </div>
        </div>

        {/* File Body */}
        <div className="flex-1 bg-[#F3F4F6] overflow-y-auto p-4 flex flex-col items-start">
          {isPdf && fileUrl ? (
            <Document
              file={fileUrl}
              onLoadSuccess={({ numPages: n }) => setNumPages(n)}
              loading={<p className="text-center text-sm text-gray-400 py-8">Đang tải PDF...</p>}
              error={<p className="text-center text-sm text-red-400 py-8">Không thể hiển thị PDF</p>}
            >
              {Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={i + 1}
                  pageNumber={i + 1}
                  className="shadow-sm rounded-md overflow-hidden [&>canvas]:!w-full [&>canvas]:!h-auto max-w-full mb-4 last:mb-0"
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              ))}
            </Document>
          ) : fileUrl ? (
            <img src={fileUrl} alt={record.name} className="max-w-full rounded-lg shadow-sm" />
          ) : (
            <p className="text-center text-sm text-gray-400 py-8">Không thể hiển thị file</p>
          )}
        </div>
      </div>

      {/* Right - OCR Data */}
      <div className="flex-1 bg-[#F9FAFB] flex flex-col gap-6 p-8 px-10 overflow-y-auto">
        <div className="flex items-center gap-4 w-full">
          <button
            onClick={() => navigate('/archive')}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
            title="Quay lại"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12.5 15L7.5 10L12.5 5" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h2 className="text-xl font-bold text-[#111827]">Thông tin OCR</h2>
        </div>

        {/* Document metadata */}
        <div
          className="bg-white rounded-2xl p-6 flex flex-col gap-3"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}
        >
          <div className="flex items-center gap-4 pb-3 border-b border-[#F3F4F6]">
            <span className="text-[13px] text-[#6B7280] w-[140px] shrink-0">Tên file</span>
            <span className="text-[13px] font-semibold text-[#111827]">{record.name}</span>
          </div>
          <div className="flex items-center gap-4 pb-3 border-b border-[#F3F4F6]">
            <span className="text-[13px] text-[#6B7280] w-[140px] shrink-0">Loại tài liệu</span>
            <span className="text-[13px] font-semibold text-[#111827]">{record.docType}</span>
          </div>
          <div className="flex items-center gap-4 pb-3 border-b border-[#F3F4F6]">
            <span className="text-[13px] text-[#6B7280] w-[140px] shrink-0">Ngày xử lý</span>
            <span className="text-[13px] font-semibold text-[#111827]">{record.date}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[13px] text-[#6B7280] w-[140px] shrink-0">Dung lượng</span>
            <span className="text-[13px] font-semibold text-[#111827]">
              {(record.fileSize / 1024 / 1024).toFixed(2)} MB
            </span>
          </div>
        </div>

        {/* OCR Results */}
        {record.ocrData && record.ocrData.length > 0 && (
          <div
            className="bg-white rounded-2xl p-6 flex flex-col gap-0"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.05)' }}
          >
            <h3 className="text-sm font-bold text-[#111827] mb-4">Dữ liệu trích xuất</h3>
            {record.ocrData.map((entity, i) => (
              <div key={i}>
                <div className="flex items-start gap-4 py-3">
                  <span className="text-[13px] text-[#6B7280] w-[180px] shrink-0">{entity.key}</span>
                  <span className="text-[13px] font-semibold text-[#111827] break-all">{entity.value}</span>
                </div>
                {i < (record.ocrData?.length ?? 0) - 1 && <div className="h-px bg-[#F3F4F6]" />}
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mt-2">
          <button
            onClick={handleDownload}
            className="flex-1 h-10 rounded-lg bg-white text-[#374151] text-sm font-semibold border border-[#D1D5DB] cursor-pointer hover:bg-gray-50 flex items-center justify-center gap-2"
          >
            <span className="material-symbols-rounded text-base">download</span>
            Tải file gốc
          </button>
          <button
            onClick={() => navigate('/archive')}
            className="flex-1 h-10 rounded-lg bg-[#0B57D0] text-white text-sm font-semibold cursor-pointer flex items-center justify-center gap-2"
            style={{ boxShadow: '0 4px 12px rgba(11,87,208,0.25)' }}
          >
            Quay lại kho
          </button>
        </div>
      </div>
    </div>
  );
};
