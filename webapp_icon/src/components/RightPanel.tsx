import React, { useState, useEffect } from 'react';
import type { UploadedFile, OCREntity, OCRStatus } from '../types';
import { Download } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { OCRResults } from './OCRResults';

// Configure PDF worker (use local module to avoid cross-origin issues with blob URLs)
pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

interface Props {
    uploadedFile: UploadedFile | null;
    ocrData: OCREntity[] | null;
    ocrStatus: OCRStatus;
    errorMessage?: string;
}

function isPdf(file: File): boolean {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

function isImage(file: File): boolean {
    if (file.type.startsWith('image/')) return true;
    const name = file.name.toLowerCase();
    return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png')
        || name.endsWith('.gif') || name.endsWith('.webp') || name.endsWith('.bmp');
}

export const RightPanel: React.FC<Props> = ({ uploadedFile, ocrData, ocrStatus, errorMessage }) => {
    const [numPages, setNumPages] = useState<number>(0);
    const [fileUrl, setFileUrl] = useState<string | null>(null);

    // Create object URL for image preview; revoke on cleanup / file change.
    // Using useEffect (not useMemo) so the URL survives React 18 StrictMode's
    // mount → unmount → remount cycle in development.
    useEffect(() => {
        if (!uploadedFile?.file || isPdf(uploadedFile.file)) {
            setFileUrl(null);
            return;
        }
        const url = URL.createObjectURL(uploadedFile.file);
        setFileUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [uploadedFile?.file]);

    function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
        setNumPages(numPages);
    }

    const renderPreview = () => {
        if (!uploadedFile) {
            return (
                <div className="w-[300px] h-[400px] flex items-center justify-center text-gray-400 text-sm">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                            <Download size={24} className="text-gray-300" />
                        </div>
                        <p>No document uploaded</p>
                    </div>
                </div>
            );
        }

        if (isPdf(uploadedFile.file)) {
            return (
                <Document
                    file={uploadedFile.file}
                    onLoadSuccess={onDocumentLoadSuccess}
                    className="flex flex-col items-center gap-4"
                    loading={
                        <div className="text-sm text-gray-400 h-full flex items-center justify-center">Loading PDF...</div>
                    }
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
            );
        }

        if (isImage(uploadedFile.file) && fileUrl) {
            return (
                <img
                    src={fileUrl}
                    alt={uploadedFile.name}
                    className="max-w-full max-h-full object-contain rounded-md shadow-sm"
                />
            );
        }

        // XML or other file type
        return (
            <div className="flex flex-col items-center gap-4 text-gray-400">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                    <span className="material-symbols-rounded text-2xl text-gray-300">code</span>
                </div>
                <p className="text-sm">{uploadedFile.name}</p>
                <p className="text-xs">Preview not available for this file type</p>
            </div>
        );
    };

    return (
        <div className="flex-1 h-full bg-white rounded-3xl shadow-[0_8px_24px_-4px_rgba(0,0,0,0.13)] border border-gray-100 flex flex-col overflow-hidden">

            {/* Right Column Header */}
            <div className="h-20 px-8 flex items-center justify-between border-b border-gray-100 shrink-0">
                <h2 className="text-xl font-semibold text-[#1F1F1F]">Analysis Results</h2>
            </div>

            <div className="flex flex-1 p-8 gap-10 overflow-hidden">

                {/* File Viewer - Left half of right panel */}
                <div className="w-1/2 h-full flex flex-col bg-[#F8F9FA] rounded-[24px] p-6 shrink-0 relative">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Source Document</span>
                    </div>

                    <div key={uploadedFile?.id} className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-y-auto flex justify-center items-start p-4">
                        {renderPreview()}
                    </div>
                </div>

                {/* OCR Extracted Data - Right half of right panel */}
                <div className="flex-1 h-full flex flex-col overflow-hidden">
                    <OCRResults data={ocrData} ocrStatus={ocrStatus} errorMessage={errorMessage} />
                </div>
            </div>
        </div>
    );
};
