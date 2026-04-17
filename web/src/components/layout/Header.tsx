import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Menu, LogOut, User, Settings, ChevronDown } from 'lucide-react';
import { cn, getInitials, getRoleLabel } from '@/lib/utils';
import { useAuthStore } from '@/store/auth.store';
import { useAttendanceStore } from '@/store/attendance.store';
import { RoleBadge } from '@/components/ui/StatusBadge';

interface HeaderProps {
  onMenuToggle?: () => void;
  className?: string;
}

export function Header({ onMenuToggle, className }: HeaderProps): JSX.Element {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const fraudAlerts = useAttendanceStore((s) => s.fraudAlerts);

  const notifCount = Math.min(fraudAlerts.length, 9);

  function handleLogout(): void {
    setIsUserMenuOpen(false);
    logout();
  }

  function handleProfile(): void {
    setIsUserMenuOpen(false);
    navigate('/profile');
  }

  return (
    <header
      className={cn(
        'flex items-center justify-between px-4 h-14 sticky top-0 z-30',
        'bg-white border-b border-neutral-200 shadow-sm',
        className,
      )}
      role="banner"
    >
      {/* Left: Hamburger (mobile) */}
      <button
        type="button"
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors"
        aria-label="Mở menu"
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Left placeholder for desktop */}
      <div className="hidden lg:block" />

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        {/* Notifications bell */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsNotifOpen(!isNotifOpen);
              setIsUserMenuOpen(false);
            }}
            className="relative p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors"
            aria-label={`Thông báo${notifCount > 0 ? ` (${notifCount} mới)` : ''}`}
            aria-expanded={isNotifOpen}
          >
            <Bell className="w-5 h-5" aria-hidden="true" />
            {notifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 text-[10px] font-bold bg-danger-base text-white rounded-full">
                {notifCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {isNotifOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-neutral-200 rounded-lg shadow-lg z-50"
              role="dialog"
              aria-label="Thông báo"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
                <p className="text-sm font-semibold text-neutral-950">Thông báo</p>
                <button
                  type="button"
                  onClick={() => setIsNotifOpen(false)}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                >
                  Đóng
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {fraudAlerts.length === 0 ? (
                  <p className="px-4 py-6 text-center text-sm text-neutral-500">
                    Không có thông báo mới
                  </p>
                ) : (
                  fraudAlerts.slice(0, 10).map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                    >
                      <span className="text-danger-base mt-0.5">
                        <Bell className="w-4 h-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-950 truncate">
                          {alert.full_name}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {alert.fraud_type}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-neutral-200 mx-1" aria-hidden="true" />

        {/* User dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setIsUserMenuOpen(!isUserMenuOpen);
              setIsNotifOpen(false);
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-neutral-100 transition-colors"
            aria-expanded={isUserMenuOpen}
            aria-label="Menu người dùng"
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.full_name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <span className="text-xs font-semibold text-primary-700">
                  {getInitials(user?.full_name ?? '?')}
                </span>
              )}
            </div>

            <div className="hidden md:block text-left min-w-0">
              <p className="text-sm font-medium text-neutral-950 truncate max-w-[120px]">
                {user?.full_name ?? 'Người dùng'}
              </p>
              {user?.role && (
                <RoleBadge role={user.role} className="mt-0.5" />
              )}
            </div>

            <ChevronDown
              className={cn(
                'w-4 h-4 text-neutral-400 transition-transform duration-fast',
                isUserMenuOpen && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>

          {/* User menu dropdown */}
          {isUserMenuOpen && (
            <div
              className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-neutral-200 rounded-lg shadow-lg z-50"
              role="menu"
              aria-label="Menu người dùng"
            >
              {/* User info */}
              <div className="px-4 py-3 border-b border-neutral-200">
                <p className="text-sm font-semibold text-neutral-950 truncate">
                  {user?.full_name}
                </p>
                <p className="text-xs text-neutral-500 truncate">{user?.email}</p>
                {user?.role && (
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {getRoleLabel(user.role)}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={handleProfile}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  role="menuitem"
                >
                  <User className="w-4 h-4 text-neutral-400" aria-hidden="true" />
                  Hồ sơ cá nhân
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-50 transition-colors"
                  role="menuitem"
                >
                  <Settings className="w-4 h-4 text-neutral-400" aria-hidden="true" />
                  Cài đặt
                </button>
              </div>

              <div className="border-t border-neutral-200 py-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-danger-base hover:bg-danger-bg transition-colors"
                  role="menuitem"
                >
                  <LogOut className="w-4 h-4" aria-hidden="true" />
                  Đăng xuất
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Click-away overlay */}
      {(isUserMenuOpen || isNotifOpen) && (
        <div
          className="fixed inset-0 z-40"
          aria-hidden="true"
          onClick={() => {
            setIsUserMenuOpen(false);
            setIsNotifOpen(false);
          }}
        />
      )}
    </header>
  );
}
