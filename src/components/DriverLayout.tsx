import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { driversApi } from '../api/drivers';
import { useDriverPresence } from '../utils/useDriverPresence';
import { useTextScale } from '../utils/textScale';
import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

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
  const isChatPage = location.pathname === '/driver/chat';

  // Persist last-seen message ID across sessions so the badge survives reloads.
  const [lastSeenId, setLastSeenId] = useState<number>(() => {
    try { return parseInt(localStorage.getItem('driverLastSeenChatId') || '0', 10) || 0; }
    catch { return 0; }
  });

  // Shared thread query — creates the thread on first load (same key as DriverChat).
  const { data: chatThread } = useQuery({
    queryKey: ['my-chat-thread'],
    queryFn: () => driversApi.getMyChatThread(),
    staleTime: Infinity,
    retry: 1,
  });

  // Poll messages while the driver is on any page (DriverChat polls at 8 s,
  // here we use 12 s — TanStack Query will use the minimum when both are mounted).
  const { data: navMessages } = useQuery({
    queryKey: ['my-chat-messages'],
    queryFn: () => driversApi.getMyChatMessages({ limit: 30 }),
    enabled: !!chatThread,
    refetchInterval: 12_000,
    staleTime: 0,
  });

  const msgs: any[] = navMessages ?? [];

  // Mark all current messages as read whenever the driver visits the chat page.
  useEffect(() => {
    if (isChatPage && msgs.length > 0) {
      const maxId = Math.max(...msgs.map((m: any) => m.id ?? 0));
      if (maxId > lastSeenId) {
        setLastSeenId(maxId);
        try { localStorage.setItem('driverLastSeenChatId', String(maxId)); } catch { /* noop */ }
      }
    }
  }, [isChatPage, msgs, lastSeenId]);

  // Count admin messages the driver hasn't seen yet.
  const unreadCount = useMemo(() => {
    if (isChatPage) return 0;
    return msgs.filter(m => m.sender_type === 'admin' && (m.id ?? 0) > lastSeenId).length;
  }, [msgs, lastSeenId, isChatPage]);

  useDriverPresence();

  const handleLogout = async () => {
    try {
      await driversApi.presenceClose();
    } catch {
      // best effort
    }
    logout();
  };

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
            const showBadge = tab.path === '/driver/chat' && unreadCount > 0;
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
                <span className="relative text-2xl leading-none">
                  {tab.icon}
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center leading-none shadow">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span className={`text-xs font-bold ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                  {tab.label}
                  {showBadge && !isActive && (
                    <span className="mr-1 inline-block w-1.5 h-1.5 rounded-full bg-red-500 align-middle" />
                  )}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
