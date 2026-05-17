import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useDarkMode } from '../utils/useDarkMode';
import { AdminNotificationBell } from './AdminNotificationBell';
import { useAdminStaleOrderNotifications } from '../hooks/useAdminNotificationHooks';

export const AdminLayout = () => {
  const logout = useAuthStore((state) => state.logout);
  const location = useLocation();
  const { isDark, toggle } = useDarkMode();

  // Monitor for stale orders that have been waiting > 5 mins
  useAdminStaleOrderNotifications();

  const navItems = [
    { name: 'لوحة التحكم', path: '/admin/dashboard', icon: '🏠' },
    { name: 'الطلبات', path: '/admin/orders', icon: '📋' },
    { name: 'المناديب', path: '/admin/drivers', icon: '🚚' },
    { name: 'العملاء', path: '/admin/customers', icon: '👥' },
    { name: 'الورديات', path: '/admin/shifts', icon: '🕒' },
    { name: 'التحليلات', path: '/admin/analytics', icon: '📈' },
    { name: 'النشاط', path: '/admin/activity', icon: '📊' },
    { name: 'الإعدادات', path: '/admin/settings', icon: '⚙️' },
  ];

  // `admin-scope` is the marker class our dark-mode CSS in index.css looks
  // for. It limits the neutral-surface inversions to the admin dashboard so
  // the driver app remains in light mode.
  return (
    <div className="admin-scope flex h-screen bg-gray-100">
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-white shadow-xl hidden md:flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-800">بوابة المسؤول</h1>
          <div className="flex items-center gap-1">
            <AdminNotificationBell />
            <button
              type="button"
              onClick={toggle}
              aria-label={isDark ? 'التحويل إلى الوضع الفاتح' : 'التحويل إلى الوضع الداكن'}
              title={isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}
              className="text-xl leading-none px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {isDark ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navItems.map((item) => (
                <Link
                    key={item.name}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${
                        location.pathname === item.path
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                >
                    <span>{item.icon}</span>
                    <span>{item.name}</span>
                </Link>
            ))}
        </nav>
        <div className="p-4 border-t border-gray-100">
          <button
            onClick={logout}
            className="w-full py-2 px-4 bg-red-50 text-red-600 font-medium rounded-lg hover:bg-red-100 transition-colors"
          >
            تسجيل الخروج
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile Header */}
        <header className="bg-white shadow relative z-10 md:hidden p-4 font-bold text-gray-800 flex justify-between items-center flex-shrink-0">
            <span className="text-lg">بوابة المسؤول</span>
            <div className="flex items-center gap-2">
              <AdminNotificationBell />
              <button
                type="button"
                onClick={toggle}
                aria-label={isDark ? 'التحويل إلى الوضع الفاتح' : 'التحويل إلى الوضع الداكن'}
                className="text-xl leading-none px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {isDark ? '☀️' : '🌙'}
              </button>
              <button onClick={logout} className="text-red-500 text-sm font-medium">خروج</button>
            </div>
        </header>

        {/* Page Content — extra bottom padding on mobile for the bottom nav */}
        <section className="flex-1 overflow-y-auto p-4 md:p-8 pb-20 md:pb-8">
          <Outlet />
        </section>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-50 md:hidden pb-safe">
        <div className="flex justify-around items-center h-16 overflow-x-auto">
          {navItems.map(item => {
            const isActive = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex flex-col items-center justify-center flex-1 h-full space-y-0.5 text-center transition-colors min-w-0 ${
                  isActive ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <span className={`text-lg leading-none transition-transform duration-200 ${isActive ? 'scale-110' : 'scale-100'}`}>{item.icon}</span>
                <span className={`text-[10px] font-semibold leading-none truncate px-0.5 ${isActive ? 'font-bold' : ''}`}>{item.name}</span>
                {isActive && (
                  <span className="absolute top-0 inset-x-4 h-0.5 bg-emerald-600 rounded-b-full shadow-sm" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
