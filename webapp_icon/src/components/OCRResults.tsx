import React, { useState, useEffect, useRef } from 'react';
import type { OCREntity, OCRStatus } from '../types';
import { useOCR } from '../contexts/OCRContext';

interface Props {
    data: OCREntity[] | null;
    ocrStatus: OCRStatus;
    errorMessage?: string;
}

export const OCRResults: React.FC<Props> = ({ data, ocrStatus, errorMessage }) => {
    const { processingStartTime } = useOCR();
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Asymptotic progress: rises quickly at first, then slows down approaching 95%
    // Never stalls at a fixed value — always incrementing smoothly
    const calcProgress = (startTime: number | null) => {
        if (!startTime) return 0;
        const elapsed = (Date.now() - startTime) / 1000; // seconds
        // Formula: 95 * (1 - e^(-t/12)) → reaches ~50% at 8s, ~80% at 20s, ~90% at 28s
        return Math.min(95, Math.round(95 * (1 - Math.exp(-elapsed / 12))));
    };

    const [progress, setProgress] = useState(() =>
        ocrStatus === 'processing' ? calcProgress(processingStartTime) : 0
    );

    useEffect(() => {
        if (ocrStatus === 'processing') {
            intervalRef.current = setInterval(() => {
                setProgress(calcProgress(processingStartTime));
            }, 200);
        } else if (ocrStatus === 'success') {
            setProgress(100);
            if (intervalRef.current) clearInterval(intervalRef.current);
        } else if (ocrStatus === 'error') {
            if (intervalRef.current) clearInterval(intervalRef.current);
        } else {
            setProgress(0);
            if (intervalRef.current) clearInterval(intervalRef.current);
        }

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [ocrStatus, processingStartTime]);

    return (
        <div className="w-full h-full flex flex-col gap-6 pl-8">
            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
                <h3 className="text-base font-semibold text-[#1F1F1F]">Extracted Entities</h3>
                {data && ocrStatus === 'success' && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        High Confidence
                    </span>
                )}
                {ocrStatus === 'error' && (
                    <span className="px-3 py-1 bg-red-100 text-red-700 text-xs font-semibold rounded-full">
                        Error
                    </span>
                )}
            </div>

            {/* Progress Indicator */}
            {ocrStatus === 'processing' && (
                <div className="flex flex-col gap-3 px-4">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-500">Processing document...</span>
                        <span className="text-sm font-semibold text-blue-600">{progress}%</span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-400">Extracting entities from your document...</p>
                </div>
            )}

            <div className="flex-1 overflow-y-auto">
                {ocrStatus === 'error' && errorMessage ? (
                    <div className="w-full flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <span className="text-red-500 text-lg shrink-0">!</span>
                        <p className="text-red-700 text-sm">{errorMessage}</p>
                    </div>
                ) : ocrStatus !== 'processing' && !data ? (
                    <div className="w-full h-[300px] flex items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl bg-gray-50/50">
                        <p className="text-gray-400 text-sm">Awaiting OCR process completion...</p>
                    </div>
                ) : data ? (
                    <div className="flex flex-col">
                        {data.map((item, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between py-6 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 px-4 rounded-xl transition-colors"
                            >
                                <span className="text-sm text-gray-500 w-1/3">{item.key}</span>
                                <span className="text-sm font-semibold text-gray-900 w-2/3 text-right">
                                    {item.value}
                                </span>
                            </div>
                        ))}
                    </div>
                ) : null}
            </div>
        </div>
    );
};
