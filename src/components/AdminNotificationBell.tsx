import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminNotificationsApi, type ChatThread } from '../api/adminNotifications';

export const AdminNotificationBell = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: threads = [] } = useQuery<ChatThread[]>({
    queryKey: ['admin-chat-threads'],
    queryFn: adminNotificationsApi.getChatThreads,
    refetchInterval: 30_000,
    retry: false,
  });

  const markRead = useMutation({
    mutationFn: adminNotificationsApi.markThreadRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-chat-threads'] });
    },
  });

  // Only show threads that have an unread message from a driver
  const unreadThreads = threads.filter(
    (t) => t.unread_count > 0 && t.last_sender_type === 'driver',
  );
  const totalUnread = unreadThreads.reduce((s, t) => s + t.unread_count, 0);

  // All threads sorted: unread first
  const sorted = [...threads].sort((a, b) => {
    if (b.unread_count !== a.unread_count) return b.unread_count - a.unread_count;
    if (!a.last_message_at) return 1;
    if (!b.last_message_at) return -1;
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
  });

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleThreadClick = (thread: ChatThread) => {
    if (thread.unread_count > 0) {
      markRead.mutate(thread.driver_id);
    }
    setOpen(false);
    navigate('/admin/drivers');
  };

  const handleMarkAllRead = () => {
    unreadThreads.forEach((t) => markRead.mutate(t.driver_id));
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="الإشعارات"
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-6 h-6 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread badge */}
        {totalUnread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 pointer-events-none">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-[9999] overflow-hidden"
          dir="rtl"
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-800 text-sm">الإشعارات</h3>
            <div className="flex items-center gap-3">
              {totalUnread > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                >
                  تحديد الكل كمقروء
                </button>
              )}
              <span className="text-xs text-gray-400">
                {totalUnread > 0 ? `${totalUnread} غير مقروء` : 'لا يوجد جديد'}
              </span>
            </div>
          </div>

          {/* Thread list */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
            {sorted.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-3xl mb-2">🔔</p>
                <p className="text-gray-400 text-sm">لا توجد إشعارات بعد</p>
              </div>
            ) : (
              sorted.map((thread) => {
                const isUnread =
                  thread.unread_count > 0 && thread.last_sender_type === 'driver';
                return (
                  <button
                    key={thread.driver_id}
                    type="button"
                    onClick={() => handleThreadClick(thread)}
                    className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-right ${
                      isUnread ? 'bg-emerald-50' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-base">
                      🚚
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-sm truncate ${
                            isUnread
                              ? 'font-bold text-gray-900'
                              : 'font-medium text-gray-700'
                          }`}
                        >
                          {thread.driver_name}
                        </span>
                        {thread.unread_count > 0 && (
                          <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-0.5 flex-shrink-0">
                            {thread.unread_count}
                          </span>
                        )}
                      </div>

                      {thread.last_message && (
                        <p
                          className={`text-xs truncate mt-0.5 ${
                            isUnread ? 'text-gray-700 font-medium' : 'text-gray-400'
                          }`}
                        >
                          {thread.last_sender_type === 'driver' ? '📩 ' : '↩️ '}
                          {thread.last_message}
                        </p>
                      )}

                      {thread.last_message_at && (
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(thread.last_message_at).toLocaleString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit',
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          {sorted.length > 0 && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
              <button
                type="button"
                onClick={() => { setOpen(false); navigate('/admin/drivers'); }}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium w-full text-center"
              >
                فتح جميع المحادثات في صفحة المناديب ←
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
