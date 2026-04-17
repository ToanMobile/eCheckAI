import type { InvoiceData, ApiResponse, ExtractInvoiceResponseData, VerifyInvoiceResponseData } from '../types';
import { getRecaptchaToken } from './recaptcha';

const API_BASE = '/api/v1';

/**
 * Extract invoice data from uploaded file via OCR
 */
export async function extractInvoice(file: File): Promise<ApiResponse<ExtractInvoiceResponseData>> {
  const recaptchaToken = await getRecaptchaToken('ocr_extract');

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/invoices/extract`, {
    method: 'POST',
    headers: recaptchaToken ? { 'x-recaptcha-token': recaptchaToken } : {},
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const msg = errorData?.error?.message || `OCR request failed: ${response.status} ${response.statusText}`;
    const details = errorData?.error?.details;
    throw new Error(details ? `${msg} — ${details}` : msg);
  }

  return response.json();
}

/**
 * Verify invoice data with GDT
 */
export async function verifyInvoice(
  invoiceData: InvoiceData,
  options?: { apiCheck?: boolean; screenshot?: boolean }
): Promise<ApiResponse<VerifyInvoiceResponseData>> {
  const recaptchaToken = await getRecaptchaToken('invoice_verify');

  const response = await fetch(`${API_BASE}/invoices/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(recaptchaToken ? { 'x-recaptcha-token': recaptchaToken } : {}),
    },
    body: JSON.stringify({ ...invoiceData, options }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error?.message || `Verification failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}
