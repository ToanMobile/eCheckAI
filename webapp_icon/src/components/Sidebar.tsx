import { Link, useLocation } from 'react-router-dom';
import { useOCR } from '../contexts/OCRContext';
import { Loader2 } from 'lucide-react';

interface SidebarItem {
  label: string;
  icon?: string;
  path: string;
}

const DASHBOARD_ITEMS: SidebarItem[] = [
  { label: 'Kho tài liệu', icon: '🏠', path: '/dashboard' },
  { label: 'Kho lưu trữ', icon: '📋', path: '/archive' },
  { label: 'OCR Processing', icon: '📁', path: '/document' },
  { label: 'Quản lý danh mục', icon: '🗂', path: '/categories' },
];

const CATEGORY_ITEMS: SidebarItem[] = [
  { label: 'Danh mục Cơ quan', path: '/categories/organizations' },
];

export const Sidebar = ({ variant = 'dashboard' }: { variant?: 'dashboard' | 'category' }) => {
  const location = useLocation();
  const items = variant === 'category' ? CATEGORY_ITEMS : DASHBOARD_ITEMS;
  const { isProcessing, processingName } = useOCR();

  return (
    <div className="w-[220px] h-full flex flex-col bg-white py-4 shrink-0">
      {items.map((item) => {
        const isActive =
          location.pathname === item.path ||
          (item.path !== '/' && location.pathname.startsWith(item.path + '/'));
        const isOCRItem = item.path === '/document';
        return (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-2.5 px-5 py-3 text-[13px] transition-colors no-underline ${
              isActive
                ? 'bg-[#E6F4FF] text-[#0B57D0] font-bold'
                : 'text-[#333] font-normal hover:bg-gray-50'
            }`}
          >
            {item.icon && <span>{item.icon}</span>}
            <span className="flex-1">{item.label}</span>
            {isOCRItem && isProcessing && (
              <span className="flex items-center gap-1" title={processingName ?? ''}>
                <Loader2 size={12} className="animate-spin text-blue-500" />
              </span>
            )}
          </Link>
        );
      })}

      {/* Processing name tooltip at bottom when active */}
      {isProcessing && processingName && (
        <div className="mt-auto px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2 text-[11px] text-blue-600">
            <Loader2 size={10} className="animate-spin shrink-0" />
            <span className="truncate" title={processingName}>{processingName}</span>
          </div>
        </div>
      )}
    </div>
  );
};
