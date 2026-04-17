import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';
import { useAttendanceWebSocket } from '@/hooks/useAttendanceWebSocket';

/**
 * Main application layout:
 * - Sticky sidebar on the left (desktop: always visible, mobile: toggle-able drawer)
 * - Sticky header on top
 * - Main content area with scroll
 */
export function AppLayout(): JSX.Element {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Single WebSocket connection managed at layout level
  const { status: wsStatus } = useAttendanceWebSocket();

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      {/* Mobile sidebar overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          aria-hidden="true"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — always visible on desktop, slide-in on mobile */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-50 transition-transform duration-300 lg:relative lg:translate-x-0',
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <Sidebar wsStatus={wsStatus} />
      </div>

      {/* Right side: header + content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header
          onMenuToggle={() => setMobileSidebarOpen((prev) => !prev)}
        />

        <main
          id="main-content"
          className="flex-1 overflow-y-auto p-6"
          role="main"
          aria-label="Nội dung chính"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
