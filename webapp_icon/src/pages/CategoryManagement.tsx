import { Link, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

const CATEGORIES = [
  { id: 1, name: 'Danh mục Cơ quan', path: '/categories/organizations' },
  { id: 2, name: 'Danh mục Loại tài liệu', path: '/categories/doc-types' },
  { id: 3, name: 'Danh mục Nhóm', path: '/categories/groups' },
  { id: 4, name: 'Danh mục Kỳ báo cáo', path: '/categories/report-periods' },
];

export const CategoryManagement = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <Sidebar variant="dashboard" />
      <div className="flex-1 flex flex-col gap-5 p-8 px-10 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="flex gap-1.5 text-[13px]">
          <Link to="/dashboard" className="text-[#0B57D0] no-underline hover:underline">Tổng quan</Link>
          <span className="text-[#999]">&gt;</span>
          <span className="text-[#666]">Quản lý danh mục</span>
        </div>

        <h1 className="text-2xl font-bold text-[#1F1F1F]">Quản lý danh mục</h1>

        {/* Table */}
        <div className="bg-white rounded-lg flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex gap-4 px-4 py-3.5 bg-[#FAFAFA]">
            <span className="text-xs font-bold text-[#666]">STT</span>
            <span className="text-xs font-bold text-[#666]">Tên loại danh mục</span>
          </div>

          {/* Rows */}
          {CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className={`flex gap-4 px-4 py-3.5 border-b border-[#F0F0F0] transition-colors ${cat.path ? 'cursor-pointer hover:bg-[#FAFAFA]' : ''}`}
              onClick={() => cat.path && navigate(cat.path)}
            >
              <span className="text-[13px] text-[#333]">{cat.id}</span>
              <span className="text-[13px] text-[#333]">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
