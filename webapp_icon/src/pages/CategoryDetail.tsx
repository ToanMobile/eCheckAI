import { useState, useMemo, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';
import { Modal } from '../components/Modal';

interface CategoryRecord {
  id: number;
  code: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  creator: string;
}

interface CategoryConfig {
  title: string;
  breadcrumb: string;
  codeLabel: string;
  codePlaceholder: string;
  namePlaceholder: string;
  mockData: CategoryRecord[];
}

const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  'organizations': {
    title: 'Danh mục Cơ quan',
    breadcrumb: 'Danh mục Cơ quan',
    codeLabel: 'Mã CQ',
    codePlaceholder: 'VD: 4904, 5120, ...',
    namePlaceholder: 'VD: Công ty Cổ phần Sữa Việt Nam',
    mockData: [
      { id: 1, code: '4904', name: 'Công ty Cổ phần Sữa Việt Nam', description: 'Vinamilk - VNM', status: 'active', creator: 'Admin' },
      { id: 2, code: '5120', name: 'Công ty Cổ phần FPT', description: 'FPT Corporation - FPT', status: 'active', creator: 'Admin' },
    ],
  },
  'doc-types': {
    title: 'Danh mục Loại tài liệu',
    breadcrumb: 'Danh mục Loại tài liệu',
    codeLabel: 'Mã loại',
    codePlaceholder: 'VD: BCTC, HD, ...',
    namePlaceholder: 'VD: Báo cáo tài chính',
    mockData: [
      { id: 1, code: 'BCTC', name: 'Báo cáo tài chính', description: 'Báo cáo tài chính định kỳ', status: 'active', creator: 'Admin' },
      { id: 2, code: 'HD', name: 'Hóa đơn', description: 'Hóa đơn GTGT, hóa đơn bán hàng', status: 'active', creator: 'Admin' },
      { id: 3, code: 'HD_NK', name: 'Hóa đơn nhập khẩu', description: 'Hóa đơn nhập khẩu hàng hóa', status: 'inactive', creator: 'Admin' },
    ],
  },
  'groups': {
    title: 'Danh mục Nhóm',
    breadcrumb: 'Danh mục Nhóm',
    codeLabel: 'Mã nhóm',
    codePlaceholder: 'VD: NH_01, ...',
    namePlaceholder: 'VD: Nhóm ngân hàng',
    mockData: [
      { id: 1, code: 'NH_BANK', name: 'Ngân hàng', description: 'Nhóm ngành ngân hàng', status: 'active', creator: 'Admin' },
      { id: 2, code: 'NH_BDS', name: 'Bất động sản', description: 'Nhóm ngành bất động sản', status: 'active', creator: 'Admin' },
      { id: 3, code: 'NH_CK', name: 'Chứng khoán', description: 'Nhóm ngành chứng khoán', status: 'inactive', creator: 'Admin' },
    ],
  },
  'report-periods': {
    title: 'Danh mục Kỳ báo cáo',
    breadcrumb: 'Danh mục Kỳ báo cáo',
    codeLabel: 'Mã kỳ',
    codePlaceholder: 'VD: Q1, CN, ...',
    namePlaceholder: 'VD: Quý 1',
    mockData: [
      { id: 1, code: 'Q1', name: 'Quý 1', description: 'Báo cáo quý 1 (01-03)', status: 'active', creator: 'Admin' },
      { id: 2, code: 'Q2', name: 'Quý 2', description: 'Báo cáo quý 2 (04-06)', status: 'active', creator: 'Admin' },
      { id: 3, code: 'Q3', name: 'Quý 3', description: 'Báo cáo quý 3 (07-09)', status: 'active', creator: 'Admin' },
      { id: 4, code: 'Q4', name: 'Quý 4', description: 'Báo cáo quý 4 (10-12)', status: 'active', creator: 'Admin' },
      { id: 5, code: 'CN', name: 'Bán niên', description: 'Báo cáo bán niên (6 tháng)', status: 'active', creator: 'Admin' },
      { id: 6, code: 'NAM', name: 'Cả năm', description: 'Báo cáo cả năm', status: 'active', creator: 'Admin' },
    ],
  },
};

const CATEGORY_OPTIONS = Object.entries(CATEGORY_CONFIGS).map(([key, cfg]) => ({
  value: key,
  label: cfg.title,
}));

export const CategoryDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const config = slug ? CATEGORY_CONFIGS[slug] : null;

  const loadRecords = (key: string): CategoryRecord[] => {
    const saved = localStorage.getItem(`category_${key}`);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* fall through */ }
    }
    return CATEGORY_CONFIGS[key]?.mockData ?? [];
  };

  const [records, setRecords] = useState<CategoryRecord[]>(() => loadRecords(slug || ''));
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingRecord, setEditingRecord] = useState<CategoryRecord | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Reset records when slug changes
  useEffect(() => {
    setRecords(loadRecords(slug || ''));
    setSearchQuery('');
  }, [slug]);

  // Form state
  const [formCategory, setFormCategory] = useState(slug || '');
  const [formCode, setFormCode] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase().trim();
    return records.filter(
      (item) =>
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  const openCreate = () => {
    setEditingRecord(null);
    setFormCategory(slug || '');
    setFormCode('');
    setFormName('');
    setFormDescription('');
    setFormStatus('active');
    setShowModal(true);
  };

  const openEdit = (record: CategoryRecord) => {
    setEditingRecord(record);
    setFormCategory(slug || '');
    setFormCode(record.code);
    setFormName(record.name);
    setFormDescription(record.description);
    setFormStatus(record.status);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecord(null);
  };

  const handleDelete = () => {
    if (deleteId === null) return;
    const updated = records.filter((r) => r.id !== deleteId);
    setRecords(updated);
    localStorage.setItem(`category_${slug}`, JSON.stringify(updated));
    setDeleteId(null);
  };

  const handleSave = () => {
    if (!formCode.trim() || !formName.trim()) return;

    const targetSlug = formCategory;
    const movingCategory = targetSlug !== slug;

    const targetRecords = movingCategory ? loadRecords(targetSlug) : records;
    let updatedCurrent = records;
    let updatedTarget = targetRecords;

    if (editingRecord) {
      if (movingCategory) {
        // Remove from current category
        updatedCurrent = records.filter((r) => r.id !== editingRecord.id);
        // Add to target category
        const newId = updatedTarget.length > 0 ? Math.max(...updatedTarget.map((r) => r.id)) + 1 : 1;
        updatedTarget = [...updatedTarget, { id: newId, code: formCode, name: formName, description: formDescription, status: formStatus, creator: editingRecord.creator }];
      } else {
        updatedCurrent = records.map((r) =>
          r.id === editingRecord.id
            ? { ...r, code: formCode, name: formName, description: formDescription, status: formStatus }
            : r
        );
      }
    } else {
      const newId = updatedTarget.length > 0 ? Math.max(...updatedTarget.map((r) => r.id)) + 1 : 1;
      const newRecord = { id: newId, code: formCode, name: formName, description: formDescription, status: formStatus, creator: 'Admin' };
      if (movingCategory) {
        updatedTarget = [...updatedTarget, newRecord];
      } else {
        updatedCurrent = [...records, newRecord];
      }
    }

    setRecords(updatedCurrent);
    localStorage.setItem(`category_${slug}`, JSON.stringify(updatedCurrent));
    if (movingCategory) {
      localStorage.setItem(`category_${targetSlug}`, JSON.stringify(updatedTarget));
    }
    closeModal();
  };

  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-gray-400">Danh mục không tồn tại</p>
      </div>
    );
  }

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
          <span className="text-[#666]">{config.breadcrumb}</span>
        </div>

        <h1 className="text-2xl font-bold text-[#1F1F1F]">{config.title}</h1>

        {/* Search Row */}
        <div className="flex justify-between items-center w-full">
          <div className="h-9 w-[240px] rounded-md border border-[#D1D5DB] px-3 flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo tên, mã..."
              className="w-full bg-transparent text-xs text-[#333] placeholder:text-[#BFBFBF] focus:outline-none"
            />
          </div>
          <button
            onClick={openCreate}
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
            <div className="w-[100px]">{config.codeLabel}</div>
            <div className="w-[560px]">Tên</div>
            <div className="flex-1">Mô tả</div>
            <div className="w-[200px]">Trạng thái</div>
            <div className="w-[100px]">Người tạo</div>
            <div className="w-[100px]">Thao tác</div>
          </div>

          {/* Rows */}
          {filteredData.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <span className="text-sm text-[#999]">Không tìm thấy kết quả</span>
            </div>
          ) : (
            filteredData.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 px-4 py-3 border-b border-[#F0F0F0] hover:bg-[#FAFAFA] transition-colors"
              >
                <div className="w-10 text-[13px] text-[#333]">{item.id}</div>
                <div className="w-[100px] text-[13px] text-[#333] font-medium">{item.code}</div>
                <div className="w-[560px] text-[13px] text-[#333]">{item.name}</div>
                <div className="flex-1 text-[13px] text-[#999] truncate">{item.description}</div>
                <div className="w-[200px]">
                  <span className={`text-xs px-2 py-1 rounded ${item.status === 'active' ? 'text-[#389E0D] bg-[#F6FFED]' : 'text-[#CF1322] bg-[#FFF1F0]'}`}>
                    {item.status === 'active' ? 'Hoạt động' : 'Không hoạt động'}
                  </span>
                </div>
                <div className="w-[100px] text-[13px] text-[#333]">{item.creator}</div>
                <div className="w-[100px] flex items-center gap-1">
                  <button
                    onClick={() => openEdit(item)}
                    className="p-1 rounded hover:bg-blue-50 text-[#666] hover:text-[#0B57D0] transition-colors cursor-pointer"
                    title="Sửa"
                  >
                    <span className="material-symbols-rounded text-[18px]">edit</span>
                  </button>
                  <button
                    onClick={() => setDeleteId(item.id)}
                    className="p-1 rounded hover:bg-red-50 text-[#666] hover:text-[#CF1322] transition-colors cursor-pointer"
                    title="Xóa"
                  >
                    <span className="material-symbols-rounded text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Delete Confirm Modal */}
      <Modal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Xác nhận xóa"
        width={400}
        footer={
          <>
            <button
              onClick={() => setDeleteId(null)}
              className="h-10 px-6 rounded-lg bg-white text-[#374151] text-sm font-semibold cursor-pointer"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              Hủy
            </button>
            <button
              onClick={handleDelete}
              className="h-10 px-6 rounded-lg bg-[#EF4444] text-white text-sm font-semibold cursor-pointer"
              style={{ boxShadow: '0 4px 12px rgba(239,68,68,0.25)' }}
            >
              Xóa
            </button>
          </>
        }
      >
        <p className="text-[13px] text-[#333]">Bạn có chắc chắn muốn xóa mục này không? Hành động này không thể hoàn tác.</p>
      </Modal>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingRecord ? `Chỉnh sửa - ${config.title}` : `Tạo mới - ${config.title}`}
        width={500}
        footer={
          <>
            <button
              onClick={closeModal}
              className="h-10 px-6 rounded-lg bg-white text-[#374151] text-sm font-semibold cursor-pointer"
              style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              className="h-10 px-6 rounded-lg bg-[#0B57D0] text-white text-sm font-semibold cursor-pointer"
              style={{ boxShadow: '0 4px 12px rgba(11,87,208,0.25)' }}
            >
              Lưu thông tin
            </button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {/* Thuộc loại - dropdown */}
          <div className="flex items-center gap-3">
            <span className="w-[120px] text-[13px] text-[#666] shrink-0">Thuộc loại</span>
            <select
              value={formCategory}
              onChange={(e) => setFormCategory(e.target.value)}
              className="flex-1 h-9 rounded-lg border border-[#D1D5DB] px-3 text-[13px] text-[#333] bg-white focus:outline-none focus:ring-1 focus:ring-[#0B57D0] cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Mã */}
          <div className="flex items-center gap-3">
            <div className="w-[120px] flex gap-0.5 shrink-0">
              <span className="text-[13px] text-[#666]">{config.codeLabel}</span>
              <span className="text-[13px] text-[#CF1322]">*</span>
            </div>
            <input
              type="text"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              placeholder={config.codePlaceholder}
              className="flex-1 h-9 rounded-lg border border-[#D1D5DB] px-3 text-[13px] text-[#333] placeholder:text-[#BFBFBF] focus:outline-none focus:ring-1 focus:ring-[#0B57D0]"
            />
          </div>

          {/* Tên */}
          <div className="flex items-center gap-3">
            <div className="w-[120px] flex gap-0.5 shrink-0">
              <span className="text-[13px] text-[#666]">Tên</span>
              <span className="text-[13px] text-[#CF1322]">*</span>
            </div>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder={config.namePlaceholder}
              className="flex-1 h-9 rounded-lg border border-[#D1D5DB] px-3 text-[13px] text-[#333] placeholder:text-[#BFBFBF] focus:outline-none focus:ring-1 focus:ring-[#0B57D0]"
            />
          </div>

          {/* Trạng thái */}
          <div className="flex items-center gap-3">
            <span className="w-[120px] text-[13px] text-[#666] shrink-0">Trạng thái</span>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as 'active' | 'inactive')}
              className="flex-1 h-9 rounded-lg border border-[#D1D5DB] px-3 text-[13px] text-[#333] bg-white focus:outline-none focus:ring-1 focus:ring-[#0B57D0] cursor-pointer appearance-none"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
            >
              <option value="active">Hoạt động</option>
              <option value="inactive">Không hoạt động</option>
            </select>
          </div>

          {/* Mô tả */}
          <div className="flex gap-3">
            <span className="w-[120px] text-[13px] text-[#666] shrink-0 pt-2">Mô tả</span>
            <textarea
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Mô tả"
              className="flex-1 h-[100px] rounded-lg border border-[#D1D5DB] px-3 py-2 text-[13px] text-[#333] placeholder:text-[#BFBFBF] focus:outline-none focus:ring-1 focus:ring-[#0B57D0] resize-none"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
