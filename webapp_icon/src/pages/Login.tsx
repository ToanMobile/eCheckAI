import { useNavigate } from 'react-router-dom';
import { FinOSLogo } from '../components/FinOSLogo';

export const Login = () => {
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/dashboard');
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#FAFAFA] font-primary">
      <div
        className="w-[440px] bg-white rounded-[24px] flex flex-col gap-8 p-12"
        style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
      >
        {/* Header */}
        <div className="flex flex-col gap-4 items-center w-full">
          <FinOSLogo />
          <h1 className="text-2xl font-semibold text-[#111827]">Đăng nhập</h1>
          <p className="text-sm text-[#6B7280]">Vui lòng nhập thông tin để tiếp tục</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-6 w-full">
          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-[#374151]">Tên đăng nhập</label>
            <div
              className="w-full h-12 px-4 flex items-center rounded-lg bg-white border border-[#D1D5DB]"
            >
              <input
                type="text"
                placeholder="Nhập tài khoản (vd: admin)"
                className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-semibold text-[#374151]">Mật khẩu</label>
            <div
              className="w-full h-12 px-4 flex items-center justify-between rounded-lg bg-white border border-[#D1D5DB]"
            >
              <input
                type="password"
                placeholder="••••••••"
                className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full h-12 bg-[#0B57D0] hover:bg-[#0A4BB3] text-white font-semibold text-[15px] rounded-lg transition-colors cursor-pointer"
            style={{ boxShadow: '0 4px 12px rgba(11,87,208,0.25)' }}
          >
            Đăng nhập
          </button>
        </form>
      </div>
    </div>
  );
};
