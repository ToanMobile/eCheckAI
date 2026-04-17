import React from 'react';
import { DocTypeSelector } from './DocTypeSelector';
import { UploadZone } from './UploadZone';
import type { DocumentType, UploadedFile, QueuedFile } from '../types';
import { Cpu, Loader2, CheckCircle2, XCircle, Clock, X, Trash2 } from 'lucide-react';

interface Props {
    docType: DocumentType;
    setDocType: (type: DocumentType) => void;
    fileQueue: QueuedFile[];
    addFiles: (files: UploadedFile[]) => void;
    removeFile: (id: string) => void;
    clearQueue: () => void;
    isProcessing: boolean;
    startOCR: () => void;
    activeId: string | null;
    setActiveId: (id: string) => void;
}

const StatusIcon: React.FC<{ status: QueuedFile['status'] }> = ({ status }) => {
    if (status === 'done') return <CheckCircle2 size={16} className="text-green-500 shrink-0" />;
    if (status === 'error') return <XCircle size={16} className="text-red-500 shrink-0" />;
    if (status === 'processing') return <Loader2 size={16} className="animate-spin text-blue-500 shrink-0" />;
    return <Clock size={16} className="text-gray-400 shrink-0" />;
};

export const LeftPanel: React.FC<Props> = ({
    docType, setDocType, fileQueue, addFiles, removeFile, clearQueue,
    isProcessing, startOCR, activeId, setActiveId,
}) => {
    const pendingCount = fileQueue.filter(f => f.status === 'pending').length;
    const canStart = pendingCount > 0 && !isProcessing;

    return (
        <div className="w-[480px] h-full flex flex-col gap-6 shrink-0 pr-8 overflow-y-auto custom-scrollbar">

            {/* Step 1 */}
            <DocTypeSelector selectedType={docType} onSelect={setDocType} />

            {/* Step 2 - Upload */}
            <div className="flex flex-col gap-3 w-full">
                <h2 className="text-xl font-semibold text-[#1F1F1F]">2. Upload File</h2>
                <UploadZone onUpload={addFiles} />

                {/* File queue list */}
                {fileQueue.length > 0 && (
                    <div className="flex flex-col gap-2 mt-1">
                        {fileQueue.map(qf => (
                            <div
                                key={qf.id}
                                onClick={() => setActiveId(qf.id)}
                                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-colors ${activeId === qf.id ? 'border-blue-400 bg-blue-50' : 'border-gray-100 bg-white hover:bg-gray-50'}`}
                            >
                                <StatusIcon status={qf.status} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{qf.name}</p>
                                    <p className="text-xs text-gray-400">{(qf.size / 1024 / 1024).toFixed(2)} MB</p>
                                </div>
                                {qf.status === 'pending' && (
                                    <button
                                        onClick={e => { e.stopPropagation(); removeFile(qf.id); }}
                                        className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Step 3 - OCR */}
            <div className="flex flex-col gap-4 w-full">
                <h2 className="text-xl font-semibold text-[#1F1F1F]">3. Xác nhận & Xử lý OCR</h2>

                <div className="w-full rounded-2xl bg-[#F8FAFF] border border-blue-100 p-4 flex flex-col gap-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                        <span>Tổng file</span>
                        <span className="font-semibold text-gray-800">{fileQueue.length}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Chờ xử lý</span>
                        <span className="font-semibold text-amber-600">{pendingCount}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>Đã xong</span>
                        <span className="font-semibold text-green-600">{fileQueue.filter(f => f.status === 'done').length}</span>
                    </div>
                    {fileQueue.some(f => f.status === 'error') && (
                        <div className="flex justify-between">
                            <span>Lỗi</span>
                            <span className="font-semibold text-red-600">{fileQueue.filter(f => f.status === 'error').length}</span>
                        </div>
                    )}
                </div>

                <button
                    disabled={!canStart}
                    onClick={startOCR}
                    className={`flex items-center justify-center gap-3 w-full h-14 rounded-full text-white font-semibold text-base transition-all duration-300 shadow-xl ${isProcessing
                        ? 'bg-blue-800 shadow-blue-900/40 cursor-wait'
                        : canStart
                            ? 'bg-[#0B57D0] hover:-translate-y-1 hover:shadow-blue-600/50 hover:bg-blue-700'
                            : 'bg-gray-300 text-gray-500 shadow-none cursor-not-allowed'
                        }`}
                >
                    {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Cpu size={20} />}
                    {isProcessing ? `Đang xử lý...` : `OCR ${pendingCount > 0 ? pendingCount + ' file' : 'tất cả'}`}
                </button>

                {fileQueue.length > 0 && !isProcessing && (
                    <button
                        onClick={clearQueue}
                        className="flex items-center justify-center gap-3 w-full h-14 rounded-full bg-red-500 text-white font-semibold text-base transition-all duration-300 shadow-xl hover:-translate-y-1 hover:bg-red-600 hover:shadow-red-400/50"
                    >
                        <Trash2 size={20} />
                        Xóa tất cả
                    </button>
                )}
            </div>
        </div>
    );
};
