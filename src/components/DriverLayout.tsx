import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { useTextScale } from '../utils/textScale';
import { driverOrdersApi } from '../api/driverOrders';

const NAV_TABS = [
  { label: 'العروض', path: '/driver/home', icon: '🔔' },
  { label: 'توصيلاتي', path: '/driver/active', icon: '🚚' },
  { label: 'سجل اليوم', path: '/driver/history', icon: '📋' },
  { label: 'محادثة', path: '/driver/chat', icon: '💬' },
  { label: 'حسابي', path: '/driver/profile', icon: '👤' },
];

export const DriverLayout = () => {
  const logout = useAuthStore(state => state.logout);
  const location = useLocation();
  const { scale, cycle, label } = useTextScale();

  // Poll active orders so the bottom-bar badge stays up to date regardless
  // of which driver page is currently open.
  const { data: activeOrders } = useQuery({
    queryKey: ['activeOrders'],
    queryFn: () => driverOrdersApi.activeOrders(),
    refetchInterval: 15000,
  });
  const activeCount = activeOrders?.length ?? 0;

  // Availability is toggled manually by the driver only — no automatic presence
  // calls or heartbeats happen here.
  const handleLogout = () => logout();


  return (
    <div className="flex flex-col min-h-screen bg-gray-50 text-gray-900">
      {/* Minimal header fixed */}
      <header className="fixed top-0 inset-x-0 z-50 bg-blue-600 text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">🏍️</span>
          <span className="text-lg font-black tracking-tight">مندوب</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Accessibility: cycles the text size for low-vision drivers */}
          <button
            onClick={cycle}
            aria-label={`تغيير حجم الخط — الحجم الحالي: ${label}`}
            title={`حجم الخط: ${label} — اضغط للتكبير`}
            className="flex items-center gap-1 text-sm font-bold bg-white/20 hover:bg-white/30 active:bg-white/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            <span aria-hidden="true" className="text-lg leading-none">🔠</span>
            <span className="text-xs">
              {scale === 1 ? 'عادي' : scale === 1.15 ? 'كبير' : 'أكبر'}
            </span>
          </button>
          <button
            onClick={handleLogout}
            className="text-sm font-semibold bg-white/20 hover:bg-white/30 active:bg-white/40 px-3 py-1.5 rounded-lg transition-colors"
          >
            خروج
          </button>
        </div>
      </header>

      {/* Scrollable page content. The `zoom` style scales every child element
          proportionally — text, buttons, icons, and touch targets — which is
          the correct accessibility behavior for low-vision users. */}
      <main
        className="flex-1 overflow-y-auto pt-16 pb-20 bg-gray-50"
        style={{ zoom: scale }}
      >
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 shadow-[0_-2px_16px_rgba(0,0,0,0.08)] z-40">
        <div className="flex justify-around h-16 max-w-lg mx-auto">
          {NAV_TABS.map(tab => {
            const isActive =
              location.pathname === tab.path ||
              (tab.path === '/driver/home' && location.pathname === '/driver');
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`relative flex flex-col items-center justify-center flex-1 gap-0.5 transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 inset-x-3 h-0.5 bg-blue-600 rounded-b-full" />
                )}
                <span className="relative inline-flex">
                  <span className="text-2xl leading-none">{tab.icon}</span>
                  {tab.path === '/driver/active' && activeCount > 0 && (
                    <span className="absolute -top-1 -right-1.5 bg-red-500 text-white font-black leading-none min-w-[17px] h-[17px] rounded-full flex items-center justify-center text-[10px] px-[3px]">
                      {activeCount > 9 ? '9+' : activeCount}
                    </span>
                  )}
                </span>
                <span className={`text-xs font-bold ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
