import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react';
import type { QueuedFile, UploadedFile, OCREntity, DocumentType } from '../types';
import { saveToArchive } from '../services/archiveStorage';
import { extractInvoice } from '../services/api';
import type { InvoiceData } from '../types';

// ---- helpers ----

function invoiceToEntities(invoice: InvoiceData): OCREntity[] {
  const entries: OCREntity[] = [];
  const add = (key: string, value: unknown) => {
    if (value !== null && value !== undefined && value !== '') {
      entries.push({ key, value: String(value) });
    }
  };
  add('Loại hóa đơn', invoice.loaiHoaDon);
  add('MST người bán', invoice.tin);
  add('Tên người bán', invoice.tenNguoiBan);
  add('Mẫu số', invoice.mau);
  add('Ký hiệu', invoice.kyhieu);
  add('Số hóa đơn', invoice.so);
  add('Ngày hóa đơn', invoice.ngay);
  add('Ngày phát hành', invoice.ngayPhatHanh);
  add('Nội dung', invoice.noiDung);
  if (invoice.thanhTienTruocThue != null) add('Thành tiền trước thuế', new Intl.NumberFormat('vi-VN').format(invoice.thanhTienTruocThue));
  if (invoice.thueSuat != null) {
    const ts = Array.isArray(invoice.thueSuat)
      ? invoice.thueSuat.map(v => `${v}%`).join(', ')
      : typeof invoice.thueSuat === 'number' ? `${invoice.thueSuat}%` : String(invoice.thueSuat);
    add('Thuế suất', ts);
  }
  if (invoice.thueGTGT != null) add('Thuế GTGT', typeof invoice.thueGTGT === 'number' ? new Intl.NumberFormat('vi-VN').format(invoice.thueGTGT) : String(invoice.thueGTGT));
  if (invoice.tongTien != null) add('Tổng tiền thanh toán', new Intl.NumberFormat('vi-VN').format(invoice.tongTien));
  add('Đơn vị tiền tệ', invoice.donViTienTe);
  if (invoice.khauTru !== undefined) add('Khấu trừ', invoice.khauTru ? 'Có' : 'Không');
  return entries;
}

const MOCK_OCR_ENTITIES: OCREntity[] = [
  { key: 'Loại hóa đơn', value: 'Hóa đơn GTGT' },
  { key: 'MST người bán', value: '0316794126' },
  { key: 'Tên người bán', value: 'CÔNG TY TNHH DEMO' },
  { key: 'Mẫu số', value: '01GTKT0/001' },
  { key: 'Ký hiệu', value: 'K25TAA' },
  { key: 'Số hóa đơn', value: '00000152' },
  { key: 'Ngày hóa đơn', value: '09/03/2026' },
  { key: 'Thành tiền trước thuế', value: '5.000.000' },
  { key: 'Thuế suất', value: '10%' },
  { key: 'Thuế GTGT', value: '500.000' },
  { key: 'Tổng tiền thanh toán', value: '5.500.000' },
  { key: 'Đơn vị tiền tệ', value: 'VND' },
];

// ---- context ----

interface OCRContextValue {
  fileQueue: QueuedFile[];
  isProcessing: boolean;
  processingName: string | null; // name of file currently being processed
  processingStartTime: number | null; // when current file OCR started
  docType: DocumentType;
  setDocType: (t: DocumentType) => void;
  mockMode: boolean;
  setMockMode: (m: boolean) => void;
  addFiles: (files: UploadedFile[]) => void;
  addProcessedFile: (qf: QueuedFile) => void;
  removeFile: (id: string) => void;
  clearQueue: () => void;
  startOCR: () => void;
}

const OCRContext = createContext<OCRContextValue | null>(null);

export const OCRProvider = ({ children }: { children: ReactNode }) => {
  const [fileQueue, setFileQueue] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingName, setProcessingName] = useState<string | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<number | null>(null);
  const [docType, setDocType] = useState<DocumentType>('invoice');
  const [mockMode, setMockMode] = useState(import.meta.env.VITE_ENABLE_API_DEMO_MODE !== 'false');

  // Ref mirrors queue to avoid stale closures in async loop
  const queueRef = useRef<QueuedFile[]>([]);
  const isProcessingRef = useRef(false);

  const updateQueue = (updater: (prev: QueuedFile[]) => QueuedFile[]) => {
    setFileQueue(prev => {
      const next = updater(prev);
      queueRef.current = next;
      return next;
    });
  };

  const addFiles = useCallback((files: UploadedFile[]) => {
    const newItems: QueuedFile[] = files.map(f => ({
      id: f.id, file: f.file, name: f.name, size: f.size,
      status: 'pending', ocrData: null,
    }));
    updateQueue(prev => [...prev, ...newItems]);
  }, []);

  const addProcessedFile = useCallback((qf: QueuedFile) => {
    updateQueue(prev => {
      if (prev.some(f => f.id === qf.id)) return prev;
      return [...prev, qf];
    });
  }, []);

  const removeFile = useCallback((id: string) => {
    updateQueue(prev => prev.filter(f => f.id !== id));
  }, []);

  const clearQueue = useCallback(() => {
    updateQueue(() => []);
  }, []);

  const startOCR = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    setIsProcessing(true);

    const toProcess = queueRef.current.filter(f => f.status === 'pending');
    const docTypeLabel = docType === 'invoice' ? 'Hóa đơn' : docType === 'financial_report' ? 'BCTC' : 'Khác';

    for (const qf of toProcess) {
      setProcessingName(qf.name);
      setProcessingStartTime(Date.now());
      updateQueue(prev => prev.map(f => f.id === qf.id ? { ...f, status: 'processing' } : f));

      try {
        let entities: OCREntity[];
        if (mockMode) {
          await new Promise(r => setTimeout(r, 10000));
          entities = MOCK_OCR_ENTITIES;
        } else {
          const result = await extractInvoice(qf.file);
          console.log('[OCR] API response:', JSON.stringify(result, null, 2));
          if (result.status === 'error' || !result.data?.invoice) {
            throw new Error(result.error?.message || 'OCR failed');
          }
          entities = invoiceToEntities(result.data.invoice);
          console.log('[OCR] Parsed entities:', entities);
        }

        updateQueue(prev => prev.map(f => f.id === qf.id ? { ...f, status: 'done', ocrData: entities } : f));

        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        await saveToArchive({
          id: qf.id, name: qf.name, date: dateStr, docType: docTypeLabel,
          ocrStatus: 'recognized', ocrData: entities,
          fileBlob: qf.file, fileMimeType: qf.file.type, fileSize: qf.size,
        }).catch(e => console.warn('Save to archive failed:', e));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'OCR failed';
        updateQueue(prev => prev.map(f => f.id === qf.id ? { ...f, status: 'error', error: errMsg } : f));

        // Save error record to archive so dashboard can track it
        const now = new Date();
        const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        await saveToArchive({
          id: qf.id, name: qf.name, date: dateStr, docType: docTypeLabel,
          ocrStatus: 'error', ocrData: null, error: errMsg,
          fileBlob: qf.file, fileMimeType: qf.file.type, fileSize: qf.size,
        }).catch(e => console.warn('Save error to archive failed:', e));
      }
    }

    setProcessingName(null);
    setProcessingStartTime(null);
    isProcessingRef.current = false;
    setIsProcessing(false);

    // Don't auto-clear queue — let the user review results
  }, [docType, mockMode]); // uses queueRef — no stale closure on fileQueue

  return (
    <OCRContext.Provider value={{
      fileQueue, isProcessing, processingName, processingStartTime,
      docType, setDocType, mockMode, setMockMode,
      addFiles, addProcessedFile, removeFile, clearQueue, startOCR,
    }}>
      {children}
    </OCRContext.Provider>
  );
};

export const useOCR = () => {
  const ctx = useContext(OCRContext);
  if (!ctx) throw new Error('useOCR must be used inside OCRProvider');
  return ctx;
};
