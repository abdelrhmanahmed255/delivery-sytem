import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export interface ToastNotification {
  id: string;
  type: 'manual-order' | 'message' | 'info' | 'admin-alert';
  title: string;
  body: string;
  timestamp: number;
  data?: Record<string, any>;
}

interface NotificationToastProps {
  notifications: ToastNotification[];
  onDismiss: (id: string) => void;
}

/**
 * Toast notifications displayed at the bottom of the screen.
 * Shows multiple notifications stacked vertically.
 *
 * - Message toasts are PERSISTENT — they stay visible until the driver opens
 *   the chat page or manually dismisses them.
 * - Manual-order toasts auto-dismiss after 8 seconds.
 * - Other toasts auto-dismiss after 5 seconds.
 */
export const NotificationToast = ({ notifications, onDismiss }: NotificationToastProps) => {
  const [visibleNotifications, setVisibleNotifications] = useState<ToastNotification[]>([]);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setVisibleNotifications(notifications);
  }, [notifications]);

  // Auto-dismiss message notifications when the driver navigates to /driver/chat
  useEffect(() => {
    if (location.pathname === '/driver/chat') {
      const messageNotifs = visibleNotifications.filter((n) => n.type === 'message');
      messageNotifs.forEach((n) => onDismiss(n.id));
    }
  }, [location.pathname, visibleNotifications, onDismiss]);

  if (visibleNotifications.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'manual-order':
        return '🔴';
      case 'message':
        return '💬';
      case 'admin-alert':
        return '⚠️';
      default:
        return 'ℹ️';
    }
  };

  const getColors = (type: string) => {
    switch (type) {
      case 'manual-order':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          headerBg: 'bg-red-100',
          headerText: 'text-red-900',
          bodyText: 'text-red-800',
          closeBtn: 'hover:bg-red-200 text-red-700',
        };
      case 'message':
        return {
          bg: 'bg-blue-50',
          border: 'border-blue-200',
          headerBg: 'bg-blue-100',
          headerText: 'text-blue-900',
          bodyText: 'text-blue-800',
          closeBtn: 'hover:bg-blue-200 text-blue-700',
        };
      case 'admin-alert':
        return {
          bg: 'bg-orange-50',
          border: 'border-orange-200',
          headerBg: 'bg-orange-100',
          headerText: 'text-orange-900',
          bodyText: 'text-orange-800',
          closeBtn: 'hover:bg-orange-200 text-orange-700',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          headerBg: 'bg-gray-100',
          headerText: 'text-gray-900',
          bodyText: 'text-gray-800',
          closeBtn: 'hover:bg-gray-200 text-gray-700',
        };
    }
  };

  // Whether the toast should persist (no auto-dismiss)
  const isPersistent = (type: string) => type === 'message' || type === 'admin-alert';

  return (
    <div
      className="fixed bottom-4 left-4 right-4 md:right-auto md:left-4 max-w-md space-y-2 z-50 pointer-events-none"
      role="region"
      aria-live="polite"
      aria-label="تنبيهات التطبيق"
    >
      {visibleNotifications.map((notif, idx) => {
        const colors = getColors(notif.type);
        const persistent = isPersistent(notif.type);
        return (
          <div
            key={notif.id}
            className={`
              ${colors.bg} ${colors.border} border rounded-2xl shadow-lg overflow-hidden
              animate-slideUp pointer-events-auto
              transform transition-all duration-300
              ${persistent ? `ring-2 ${notif.type === 'admin-alert' ? 'ring-orange-400' : 'ring-blue-400'} ring-opacity-60` : ''}
            `}
            style={{
              animation: `slideUp 0.3s ease-out`,
              animationDelay: `${idx * 50}ms`,
            }}
          >
            {/* Header with icon and title */}
            <div className={`${colors.headerBg} px-4 py-3 flex items-start justify-between gap-3`}>
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className={`text-2xl flex-shrink-0 mt-0.5 ${persistent ? 'animate-bounce' : ''}`} aria-hidden="true">
                  {getIcon(notif.type)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`font-black text-base ${colors.headerText} leading-snug`}>
                    {notif.title}
                  </p>
                  {persistent && (
                    <p className={`text-xs mt-0.5 font-semibold ${notif.type === 'admin-alert' ? 'text-orange-600' : 'text-blue-500'}`}>
                      🔔 {notif.type === 'admin-alert' ? 'هذا التنبيه سيبقى حتى يتم اتخاذ إجراء' : 'هذا التنبيه سيبقى حتى تفتح المحادثة'}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={() => onDismiss(notif.id)}
                className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${colors.closeBtn} transition-colors`}
                aria-label="إغلاق التنبيه"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className={`px-4 py-3 ${colors.bodyText}`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                {notif.body}
              </p>

              {notif.data && notif.type === 'manual-order' && (
                <div className="mt-3 space-y-2 text-xs">
                  {notif.data.price && (
                    <div className="flex items-center justify-between font-bold bg-white/50 rounded px-2 py-1">
                      <span>المبلغ:</span>
                      <span>{notif.data.price} ج.م</span>
                    </div>
                  )}
                  {notif.data.address && (
                    <div className="bg-white/50 rounded px-2 py-1">
                      <p className="font-bold">📍 العنوان:</p>
                      <p className="mt-0.5 line-clamp-2">{notif.data.address}</p>
                    </div>
                  )}
                  {notif.data.eta && (
                    <div className="flex items-center justify-between font-bold bg-white/50 rounded px-2 py-1">
                      <span>⏱ الوقت المتوقع:</span>
                      <span>{notif.data.eta} دقيقة</span>
                    </div>
                  )}
                </div>
              )}

              {/* "Go to chat" button for message notifications */}
              {notif.type === 'message' && (
                <button
                  onClick={() => {
                    onDismiss(notif.id);
                    navigate('/driver/chat');
                  }}
                  className="mt-3 w-full bg-blue-600 active:bg-blue-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <span aria-hidden="true">💬</span>
                  فتح المحادثة
                </button>
              )}

              {notif.type === 'admin-alert' && (
                <button
                  onClick={() => {
                    onDismiss(notif.id);
                    navigate('/admin/orders');
                  }}
                  className="mt-3 w-full bg-orange-600 active:bg-orange-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                >
                  <span aria-hidden="true">📋</span>
                  عرض الطلبات
                </button>
              )}
            </div>

            {/* Auto-dismiss timer — only for non-persistent notifications */}
            {!persistent && (
              <div className="h-1 bg-black/10 overflow-hidden">
                <div
                  className="h-full bg-current opacity-30"
                  style={{
                    animation: `shrinkWidth ${notif.type === 'manual-order' ? '8' : '5'}s linear forwards`,
                  }}
                />
              </div>
            )}

            {/* Persistent indicator bar */}
            {persistent && (
              <div className={`h-1 ${notif.type === 'admin-alert' ? 'bg-orange-300' : 'bg-blue-300'}`}>
                <div
                  className={`h-full ${notif.type === 'admin-alert' ? 'bg-orange-500' : 'bg-blue-500'}`}
                  style={{
                    animation: 'persistentPulse 2s ease-in-out infinite',
                  }}
                />
              </div>
            )}
          </div>
        );
      })}

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shrinkWidth {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }

        @keyframes persistentPulse {
          0%, 100% {
            opacity: 0.4;
            width: 100%;
          }
          50% {
            opacity: 1;
            width: 60%;
          }
        }
      `}</style>
    </div>
  );
};
