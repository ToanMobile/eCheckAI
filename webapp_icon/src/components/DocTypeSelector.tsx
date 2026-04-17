import React from 'react';
import type { DocumentType } from '../types';
import { FileText, FileSpreadsheet, FileBox } from 'lucide-react';

interface Props {
    selectedType: DocumentType;
    onSelect: (type: DocumentType) => void;
}

export const DocTypeSelector: React.FC<Props> = ({ selectedType, onSelect }) => {
    const options = [
        { id: 'invoice', label: 'Invoice', icon: FileText },
        { id: 'financial_report', label: 'Financial Report', icon: FileSpreadsheet },
        { id: 'other', label: 'Other', icon: FileBox }
    ] as const;

    return (
        <div className="flex flex-col gap-4 w-full">
            <h2 className="text-xl font-semibold text-[#1F1F1F]">1. Select Document Type</h2>
            <div className="flex flex-col gap-3">
                {options.map(option => {
                    const isSelected = selectedType === option.id;
                    const Icon = option.icon;
                    return (
                        <button
                            key={option.id}
                            onClick={() => onSelect(option.id)}
                            className={`flex items-center gap-4 px-5 py-4 w-full text-left rounded-2xl border transition-all duration-200 shadow-sm ${isSelected
                                ? 'bg-[#F0F4FA] border-blue-600'
                                : 'bg-white border-transparent hover:border-gray-300'
                                }`}
                        >
                            <div className={`p-2 rounded-lg flex items-center justify-center ${isSelected ? 'text-blue-600 bg-blue-100' : 'text-gray-500 bg-gray-50'}`}>
                                <Icon size={20} />
                            </div>
                            <span className={`flex-1 font-medium ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                                {option.label}
                            </span>
                            {isSelected && (
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                    Selected
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>
        </div>
    );
};
