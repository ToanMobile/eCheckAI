import { Link, useLocation } from 'react-router-dom';
import { FinOSLogo } from './FinOSLogo';

export const Header = () => {
  const location = useLocation();
  const path = location.pathname;

  const isArchiveSection = path === '/dashboard' || path === '/archive' || path.startsWith('/document');
  const isCategorySection = path.startsWith('/categories');

  return (
    <header
      className="h-[72px] px-12 w-full flex justify-between items-center bg-white shrink-0 z-10"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
    >
      <FinOSLogo />

      <nav className="flex items-center gap-6">
        <Link
          to="/dashboard"
          className={`text-sm font-medium transition-colors ${
            isArchiveSection ? 'text-[#0B57D0]' : 'text-[#5E5E5E] hover:text-[#333]'
          }`}
        >
          Kho lưu trữ
        </Link>
        <Link
          to="/categories"
          className={`text-sm font-medium transition-colors ${
            isCategorySection ? 'text-[#0B57D0]' : 'text-[#5E5E5E] hover:text-[#333]'
          }`}
        >
          Quản lý danh mục
        </Link>
      </nav>

      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#E0E0E0] flex items-center justify-center">
          <span className="text-[#5E5E5E] font-semibold text-base">A</span>
        </div>
      </div>
    </header>
  );
};
