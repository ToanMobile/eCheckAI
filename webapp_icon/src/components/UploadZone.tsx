import React, { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud } from 'lucide-react';
import type { UploadedFile } from '../types';

interface Props {
    onUpload: (files: UploadedFile[]) => void;
}

export const UploadZone: React.FC<Props> = ({ onUpload }) => {
    const onDrop = useCallback((acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;
        onUpload(acceptedFiles.map(f => ({
            file: f,
            id: crypto.randomUUID(),
            name: f.name,
            size: f.size,
        })));
    }, [onUpload]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'application/pdf': ['.pdf'],
            'image/jpeg': ['.jpg', '.jpeg'],
            'image/png': ['.png'],
        },
        maxSize: 52428800, // 50MB
    });

    return (
        <div
            {...getRootProps()}
            className={`w-full p-6 flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl cursor-pointer transition-colors ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-blue-200 bg-[#F8FAFF] hover:bg-blue-50'}`}
        >
            <input {...getInputProps()} />
            <div className="w-10 h-10 rounded-2xl bg-[#D3E3FD] flex items-center justify-center text-blue-700">
                <UploadCloud size={20} />
            </div>
            <div className="text-center">
                <p className="text-sm font-medium text-gray-900">Kéo thả file vào đây</p>
                <p className="text-xs text-gray-500 mt-0.5">PDF, JPEG, PNG · Tối đa 50MB mỗi file</p>
            </div>
            <div className="px-5 py-2 bg-white text-gray-700 text-sm font-semibold rounded-full border border-gray-200 shadow-sm hover:shadow transition-all">
                Chọn file
            </div>
        </div>
    );
};
