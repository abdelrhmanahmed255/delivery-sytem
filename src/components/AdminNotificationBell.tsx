import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { adminNotificationsApi, type ChatSummaryThread } from '../api/adminNotifications';

const CURSOR_KEY = 'admin_chat_poll_cursor';

export const AdminNotificationBell = () => {
  const [open, setOpen] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Persistent poll cursor — advances after each successful poll
  const lastMsgIdRef = useRef<number>(0);
  useEffect(() => {
    try {
      const stored = parseInt(localStorage.getItem(CURSOR_KEY) ?? '0', 10);
      if (stored > 0) lastMsgIdRef.current = stored;
    } catch { /* ignore */ }
  }, []);

  // ── Summary: badge count + thread inbox (refetch every 30 s) ────────────
  const { data: summary } = useQuery({
    queryKey: ['admin-chat-summary'],
    queryFn: () => adminNotificationsApi.getSummary({ limit: 50 }),
    refetchInterval: 30_000,
    retry: false,
  });

  // ── Poll: incremental new-message detection (every 15 s) ────────────────
  const { data: pollData } = useQuery({
    queryKey: ['admin-chat-poll'],
    queryFn: () => adminNotificationsApi.poll(lastMsgIdRef.current),
    refetchInterval: 15_000,
    retry: false,
  });

  // Advance cursor and trigger summary refresh when new messages arrive
  useEffect(() => {
    if (!pollData?.messages?.length) return;
    const maxId = Math.max(...pollData.messages.map(m => m.id));
    if (maxId > lastMsgIdRef.current) {
      lastMsgIdRef.current = maxId;
      try { localStorage.setItem(CURSOR_KEY, String(maxId)); } catch { /* ignore */ }
      queryClient.invalidateQueries({ queryKey: ['admin-chat-summary'] });
      setHasNewMessages(true);
    }
  }, [pollData, queryClient]);

  const pendingCount = summary?.pending_thread_count ?? 0;
  const threads: ChatSummaryThread[] = summary?.threads ?? [];

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleOpen = () => {
    setOpen(v => !v);
    setHasNewMessages(false);
  };

  const handleThreadClick = (thread: ChatSummaryThread) => {
    setOpen(false);
    // Navigate to drivers page and pass the target driver so the chat modal
    // opens automatically without requiring the admin to find the row manually.
    navigate('/admin/drivers', {
      state: { chatDriver: { id: thread.driver_id, full_name: thread.driver_name } },
    });
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="إشعارات المحادثات"
        className={`relative p-2 rounded-lg hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 ${
          hasNewMessages ? 'animate-pulse' : ''
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-6 h-6 ${pendingCount > 0 ? 'text-emerald-600' : 'text-gray-600'}`}
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

        {/* Pending count badge */}
        {pendingCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 pointer-events-none">
            {pendingCount > 99 ? '99+' : pendingCount}
          </span>
        )}

        {/* Blue dot for new-since-last-open */}
        {hasNewMessages && pendingCount === 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-500 rounded-full border-2 border-white pointer-events-none" />
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
            <h3 className="font-bold text-gray-800 text-sm">رسائل المناديبين</h3>
            <span className="text-xs text-gray-400">
              {pendingCount > 0
                ? `${pendingCount} ${pendingCount === 1 ? 'رسالة تنتظر' : 'رسائل تنتظر'} ردك`
                : 'لا توجد رسائل جديدة'}
            </span>
          </div>

          {/* Thread list */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-gray-50">
            {threads.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <p className="text-3xl mb-2">💬</p>
                <p className="text-gray-400 text-sm">لا توجد رسائل معلقة</p>
                <p className="text-gray-300 text-xs mt-1">ستظهر هنا رسائل المناديبين التي تنتظر ردك</p>
              </div>
            ) : (
              threads.map((thread) => (
                <button
                  key={thread.thread_id}
                  type="button"
                  onClick={() => handleThreadClick(thread)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-emerald-50 transition-colors text-right bg-emerald-50/40"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-base">
                    🚚
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-bold text-gray-900 truncate">
                        {thread.driver_name}
                      </span>
                      <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    </div>
                    <p className="text-xs text-gray-600 font-medium truncate mt-0.5">
                      📩 {thread.last_message_preview}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(thread.last_message_at).toLocaleString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            <button
              type="button"
              onClick={() => { setOpen(false); navigate('/admin/drivers'); }}
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium w-full text-center"
            >
              فتح جميع المحادثات في صفحة المناديب ←
            </button>
          </div>
        </div>
      )}
    </div>
  );
};


