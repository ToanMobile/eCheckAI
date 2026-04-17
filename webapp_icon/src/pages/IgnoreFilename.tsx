import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { LeftPanel } from '../components/LeftPanel';
import { RightPanel } from '../components/RightPanel';
import { getArchiveRecord } from '../services/archiveStorage';
import { useOCR } from '../contexts/OCRContext';
import type { UploadedFile, OCRStatus } from '../types';

export const IgnoreFilename = () => {
  const [searchParams] = useSearchParams();
  const [activeId, setActiveId] = useState<string | null>(null);

  const {
    fileQueue,
    isProcessing,
    docType, setDocType,
    mockMode, setMockMode,
    addFiles,
    addProcessedFile,
    removeFile,
    clearQueue,
    startOCR,
  } = useOCR();

  // Load from archive if ?id= (single) or ?ids= (multiple) is present
  useEffect(() => {
    const archiveId = searchParams.get('id');
    const archiveIds = searchParams.get('ids');
    if (!archiveId) return;

    // All IDs to load: primary + extras from ?ids=
    const allIds = archiveIds
      ? [archiveId, ...archiveIds.split(',').filter(id => id && id !== archiveId)]
      : [archiveId];

    (async () => {
      // Clear old queue before loading fresh files from archive
      clearQueue();
      setActiveId(null);

      for (const id of allIds) {
        try {
          const record = await getArchiveRecord(id);
          if (record) {
            // Read blob to ArrayBuffer immediately — IndexedDB blob refs can become
            // inaccessible after the DB connection is closed (db.close() in getArchiveRecord)
            const arrayBuffer = await record.fileBlob.arrayBuffer();
            const mimeType = record.fileMimeType || record.fileBlob.type;
            const file = new File([arrayBuffer], record.name, { type: mimeType });
            addProcessedFile({
              id: record.id,
              file,
              name: record.name,
              size: record.fileSize,
              status: record.ocrStatus === 'error' ? 'error' : 'done',
              ocrData: record.ocrData,
              error: record.error,
            });
            // Set active + docType from the primary record immediately when found
            if (id === archiveId) {
              setActiveId(record.id);
              if (record.docType === 'BCTC') setDocType('financial_report');
              else if (record.docType === 'Khác') setDocType('other');
              else setDocType('invoice');
            }
          }
        } catch (err) {
          console.error('Failed to load archive record:', id, err);
        }
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleAddFiles = (files: UploadedFile[]) => {
    addFiles(files);
    if (files.length > 0) setActiveId(files[0].id);
  };

  const handleRemoveFile = (id: string) => {
    removeFile(id);
    setActiveId(prev => prev === id ? null : prev);
  };

  // Auto-select the processing file when activeId is null (e.g. after navigating back)
  useEffect(() => {
    if (!activeId) {
      const processing = fileQueue.find(f => f.status === 'processing');
      if (processing) setActiveId(processing.id);
    }
  }, [fileQueue, activeId]);

  // Derive RightPanel props from active file
  const activeFile = fileQueue.find(f => f.id === activeId) ?? null;
  const uploadedFileForPanel: UploadedFile | null = activeFile
    ? { file: activeFile.file, id: activeFile.id, name: activeFile.name, size: activeFile.size }
    : null;
  const ocrDataForPanel = activeFile?.ocrData ?? null;
  const ocrStatusForPanel: OCRStatus = activeFile
    ? (activeFile.status === 'pending' ? 'idle'
      : activeFile.status === 'processing' ? 'processing'
      : activeFile.status === 'done' ? 'success'
      : 'error')
    : 'idle';

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <Sidebar variant="dashboard" />
      <div className="flex-1 flex flex-col gap-10 py-12 px-10 overflow-y-auto">
        {searchParams.get('id') && (
          <div className="flex gap-1.5 text-[13px]">
            <Link to="/dashboard" className="text-[#0B57D0] no-underline hover:underline">Tổng quan</Link>
            <span className="text-[#999]">&gt;</span>
            <Link to="/archive" className="text-[#0B57D0] no-underline hover:underline">Kho lưu trữ</Link>
            <span className="text-[#999]">&gt;</span>
            <span className="text-[#666]">{activeFile?.name ?? 'Tài liệu'}</span>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h1 className="text-[40px] font-bold text-[#1F1F1F] tracking-tight leading-tight">
            OCR Processing
          </h1>
          <p className="text-base text-[#5E5E5E]">
            Upload hóa đơn điện tử (PDF, JPEG, PNG) để trích xuất dữ liệu tự động.
          </p>
        </div>

        {/* Mock mode toggle — hidden when VITE_ENABLE_API_DEMO_MODE=false (always real API) */}
        {import.meta.env.VITE_ENABLE_API_DEMO_MODE !== 'false' && (
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMockMode(!mockMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${mockMode ? 'bg-amber-500' : 'bg-[#0B57D0]'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${mockMode ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm text-[#5E5E5E]">
            {mockMode ? <span className="text-amber-600 font-medium">Demo mode</span> : <span className="text-[#0B57D0] font-medium">eCheckAI API</span>}
            <span className="text-[#999] ml-1.5">{mockMode ? '(dữ liệu giả, không tốn phí)' : '(gọi API thật)'}</span>
          </span>
        </div>
        )}

        <div className="flex-1 flex gap-8 min-h-0">
          <LeftPanel
            docType={docType}
            setDocType={setDocType}
            fileQueue={fileQueue}
            addFiles={handleAddFiles}
            removeFile={handleRemoveFile}
            clearQueue={clearQueue}
            isProcessing={isProcessing}
            startOCR={startOCR}
            activeId={activeId}
            setActiveId={setActiveId}
          />
          <RightPanel
            key={activeId ?? 'none'}
            uploadedFile={uploadedFileForPanel}
            ocrData={ocrDataForPanel}
            ocrStatus={ocrStatusForPanel}
            errorMessage={activeFile?.error}
          />
        </div>
      </div>
    </div>
  );
};
