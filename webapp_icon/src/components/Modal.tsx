import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children, footer, width = 500 }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-[24px] flex flex-col overflow-hidden"
        style={{
          width,
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-6 pb-4">
          <h2 className="text-xl font-bold text-[#111827]">{title}</h2>
        </div>

        {/* Body */}
        <div className="px-8 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-center gap-4 px-8 py-6 bg-[#F9FAFB] rounded-b-[24px]">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
