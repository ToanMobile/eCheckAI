/**
 * Archive Storage Service
 * Uses IndexedDB to persist OCR results + file blobs for the archive page.
 * Supports: save, list, get, delete archive records.
 */

import type { OCREntity } from '../types';

export interface ArchiveRecord {
  id: string;
  name: string;
  date: string;
  docType: string;
  ocrStatus: 'recognized' | 'error' | 'pending';
  error?: string;
  ocrData: OCREntity[] | null;
  fileBlob: Blob;
  fileMimeType: string;
  fileSize: number;
}

/** Lightweight record without the file blob (for listing) */
export type ArchiveRecordMeta = Omit<ArchiveRecord, 'fileBlob'>;

const DB_NAME = 'edocai_archive';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
        store.createIndex('ocrStatus', 'ocrStatus', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a document to the archive
 */
export async function saveToArchive(record: ArchiveRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/**
 * Get all archive records (metadata only, no file blobs for performance)
 */
export async function listArchive(): Promise<ArchiveRecordMeta[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      db.close();
      const records: ArchiveRecord[] = request.result;
      // Return without fileBlob to save memory, sorted newest first
      const metas: ArchiveRecordMeta[] = records
        .map(({ fileBlob: _, ...meta }) => meta)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(metas);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Get a single archive record by ID (includes file blob)
 */
export async function getArchiveRecord(id: string): Promise<ArchiveRecord | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);

    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

/**
 * Delete a record from the archive
 */
export async function deleteFromArchive(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}
