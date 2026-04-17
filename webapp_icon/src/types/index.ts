export type DocumentType = 'invoice' | 'financial_report' | 'other';

export interface UploadedFile {
    file: File;
    id: string;
    name: string;
    size: number;
}

export interface OCREntity {
    key: string;
    value: string;
}

export type OCRStatus = 'idle' | 'processing' | 'success' | 'error';

export interface QueuedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'done' | 'error';
  ocrData: OCREntity[] | null;
  error?: string;
}

export interface AppState {
    docType: DocumentType;
    uploadedFile: UploadedFile | null;
    ocrStatus: OCRStatus;
    ocrData: OCREntity[] | null;
}

// --- Invoice Verification API types (from finosvn/invoice-verification) ---

export interface DongHangHoa {
    ten: string;
    soLuong?: number;
    donVi?: string;
    donGia?: number;
    tienChietKhau?: number;
    thanhTienTruocThue?: number;
    thueSuat?: string;
    tienThue?: number;
    thanhTienSauThue?: number;
}

export interface ChiTietThueSuat {
    [thueSuat: string]: DongHangHoa[];
}

export interface TongHopThueSuatItem {
    thanhTienTruocThue: number;
    tienThue: number;
    tongTienThanhToan: number;
}

export interface TongHopThueSuat {
    [thueSuat: string]: TongHopThueSuatItem;
}

export interface InvoiceData {
    tin: string;
    mau: string;
    kyhieu: string;
    so: string;
    ngay?: string;
    tongTien?: number;
    thueGTGT?: number | string | null;
    thanhTienTruocThue?: number | null;
    thueSuat?: number | string | number[] | null;
    tenNguoiBan?: string;
    donViTienTe?: string;
    tiGia?: number;
    loaiHoaDon?: string;
    ngayPhatHanh?: string;
    noiDung?: string;
    khauTru?: boolean;
    chiTietThueSuat?: ChiTietThueSuat;
    tongHopThueSuat?: TongHopThueSuat;
}

export interface VerificationResult {
    valid: boolean;
    message: string;
    gdtResponseRaw?: string;
    details?: unknown;
}

export interface ApiResponse<T> {
    status: 'success' | 'invalid' | 'error';
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: string;
    };
    processedAt: string;
    duration?: number;
}

export interface ExtractInvoiceResponseData {
    invoice: InvoiceData;
}

export interface VerifyInvoiceResponseData {
    invoice: InvoiceData;
    verification: VerificationResult;
    finalCaptchaImage?: string;
    finalCaptchaCode?: string;
    screenshot?: {
        success: boolean;
        image?: string;
        apiResponse?: unknown;
        error?: string;
    };
}
