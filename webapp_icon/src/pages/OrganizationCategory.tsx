import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Modal } from '../components/Modal';

interface OrgRecord {
  id: number;
  orgId: string;
  name: string;
  taxCode: string;
  ticker: string;
  description: string;
  status: 'active' | 'inactive';
  creator: string;
}

const MOCK_ORGS: OrgRecord[] = [
  { id: 1, orgId: '4904', name: 'Công ty Cổ phần Sữa Việt Nam', taxCode: '0300588569', ticker: 'VNM', description: 'Vinamilk', status: 'inactive', creator: 'Admin' },
  { id: 2, orgId: '5120', name: 'Công ty Cổ phần FPT', taxCode: '0101248141', ticker: 'FPT', description: 'FPT Corporation', status: 'inactive', creator: 'Admin' },
];

export const OrganizationCategory = () => {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      <Sidebar variant="category" />
      <div className="flex-1 flex flex-col gap-4 p-8 px-10 overflow-y-auto">
        {/* Breadcrumb */}
        <div className="flex gap-1.5 text-[13px]">
          <Link to="/dashboard" className="text-[#0B57D0] no-underline hover:underline">Tổng quan</Link>
          <span className="text-[#999]">&gt;</span>
          <Link to="/categories" className="text-[#0B57D0] no-underline hover:underline">Quản lý danh mục</Link>
          <span className="text-[#999]">&gt;</span>
          <span className="text-[#666]">Danh mục Cơ quan</span>
        </div>

        <h1 className="text-2xl font-bold text-[#1F1F1F]">Danh mục Cơ quan</h1>

        {/* Search Row */}
        <div className="flex justify-between items-center w-full">
          <div className="h-9 w-[240px] rounded-md border border-[#D1D5DB] px-3 flex items-center">
            <input
              type="text"
              placeholder="Tìm kiếm theo tên, mã tổ..."
              className="w-full bg-transparent text-xs text-[#333] placeholder:text-[#BFBFBF] focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 h-10 px-6 rounded-lg bg-[#0B57D0] text-white text-sm font-semibold cursor-pointer"
            style={{ boxShadow: '0 4px 12px rgba(11,87,208,0.25)' }}
          >
            Tạo mới
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#FAFAFA] text-xs font-bold text-[#666]">
            <div className="w-10">STT</div>
            <div className="w-[120px]">OrganizationId</div>
            <div className="w-[120px]">Tên</div>
            <div className="w-20">TaxCode</div>
            <div className="w-[100px]">Ticker</div>
            <div className="w-[300px]">Mô tả</div>
            <div className="w-[100px]">Trạng thái</div>
            <div className="w-[100px]">Người tạo</div>
            <div className="w-20">Thao tác</div>
          </div>

          {/* Rows */}
          {MOCK_ORGS.map((org) => (
            <div
              key={org.id}
              className="flex items-center gap-3 px-4 py-3 border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors"
            >
              <div className="w-10 text-[13px] text-[#333]">{org.id}</div>
              <div className="w-[120px] text-[13px] text-[#333]">{org.orgId}</div>
              <div className="w-[120px] text-[13px] text-[#333] truncate">{org.name}</div>
              <div className="w-20 text-[13px] text-[#333]">{org.taxCode}</div>
              <div className="w-[100px] text-[13px] text-[#333]">{org.ticker}</div>
              <div className="w-[300px] text-[13px] text-[#333] truncate">{org.description}</div>
              <div className="w-[100px]">
                <span className="text-xs text-[#CF1322] bg-[#FFF1F0] px-2 py-1 rounded">
                  {org.status === 'inactive' ? 'Không hoạt động' : 'Hoạt động'}
                </span>
              </div>
              <div className="w-[100px] text-[13px] text-[#333]">{org.creator}</div>
              <div className="w-20 text-[13px] text-[#0B57D0] cursor-pointer hover:underline">
                Sửa
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Tạo Mới Danh Mục"
        width={500}
        footer={
          <>
            <button
              onClick={() => setShowCreate(false)}
              className="h-10 px-6 rounded-lg bg-white text-[#374151] text-sm font-semibold cursor-pointer"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              Hủy
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="h-10 px-6 rounded-lg bg-[#0B57D0] text-white text-sm font-semibold cursor-pointer"
              style={{ boxShadow: '0 4px 12px rgba(11,87,208,0.25)' }}
            >
              Lưu thông tin
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Thuộc loại */}
          <div className="flex items-center gap-3">
            <span className="w-[120px] text-[13px] text-[#666] shrink-0">Thuộc loại</span>
            <div className="flex-1 h-9 rounded-lg bg-white border border-[#D1D5DB] px-3 flex items-center">
              <span className="text-[13px] text-[#999]">Danh mục Cơ quan</span>
            </div>
          </div>

          {/* Tên */}
          <div className="flex items-center gap-3">
            <div className="w-[120px] flex gap-0.5 shrink-0">
              <span className="text-[13px] text-[#666]">Tên</span>
              <span className="text-[13px] text-[#CF1322]">*</span>
            </div>
            <input
              type="text"
              placeholder="Tên"
              className="flex-1 h-9 rounded-lg border border-[#D1D5DB] px-3 text-[13px] text-[#333] placeholder:text-[#BFBFBF] focus:outline-none focus:ring-1 focus:ring-[#0B57D0]"
            />
          </div>

          {/* OrganizationId */}
          <div className="flex items-center gap-3">
            <div className="w-[120px] flex gap-0.5 shrink-0">
              <span className="text-[13px] text-[#666]">OrganizationId</span>
              <span className="text-[13px] text-[#CF1322]">*</span>
            </div>
            <input
              type="text"
              placeholder="OrganizationId"
              className="flex-1 h-9 rounded-lg border border-[#D1D5DB] px-3 text-[13px] text-[#333] placeholder:text-[#BFBFBF] focus:outline-none focus:ring-1 focus:ring-[#0B57D0]"
            />
          </div>

          {/* TaxCode */}
          <div className="flex items-center gap-3">
            <span className="w-[120px] text-[13px] text-[#666] shrink-0">TaxCode</span>
            <input
              type="text"
              placeholder="TaxCode"
              className="flex-1 h-9 rounded-lg border border-[#D1D5DB] px-3 text-[13px] text-[#333] placeholder:text-[#BFBFBF] focus:outline-none focus:ring-1 focus:ring-[#0B57D0]"
            />
          </div>

          {/* Ticker */}
          <div className="flex items-center gap-3">
            <div className="w-[120px] flex gap-0.5 shrink-0">
              <span className="text-[13px] text-[#666]">Ticker</span>
              <span className="text-[13px] text-[#CF1322]">*</span>
            </div>
            <input
              type="text"
              placeholder="Ticker"
              className="flex-1 h-9 rounded-lg border border-[#D1D5DB] px-3 text-[13px] text-[#333] placeholder:text-[#BFBFBF] focus:outline-none focus:ring-1 focus:ring-[#0B57D0]"
            />
          </div>

          {/* Tên nhóm */}
          <div className="flex items-center gap-3">
            <span className="w-[120px] text-[13px] text-[#666] shrink-0">Tên nhóm</span>
            <div className="flex-1 h-9 rounded-lg border border-[#D1D5DB] px-3 flex items-center">
              <span className="text-[13px] text-[#BFBFBF]">Tên nhóm ▼</span>
            </div>
          </div>

          {/* Mô tả */}
          <div className="flex gap-3">
            <span className="w-[120px] text-[13px] text-[#666] shrink-0 pt-2">Mô tả</span>
            <textarea
              placeholder="Mô tả"
              className="flex-1 h-[100px] rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13px] text-[#333] placeholder:text-[#BFBFBF] focus:outline-none focus:ring-1 focus:ring-[#0B57D0] resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
