import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  getBroadcastManager,
  type NotificationBroadcast,
} from '../utils/broadcastNotifications';
import {
  playAlertSound,
  vibrateManualOrder,
  playMessageSound,
  vibrateMessage,
  showManualOrderNotification,
  showMessageNotification,
} from '../utils/notifications';

export interface GlobalNotification extends NotificationBroadcast {
  id: string;
  type: 'manual-order' | 'message' | 'dismiss' | 'admin-alert';
  title?: string;
  body?: string;
  timestamp: number;
  data?: Record<string, any>;
}

interface NotificationContextType {
  notifications: GlobalNotification[];
  dismissNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/**
 * Global notification provider that works across all tabs
 */
export const GlobalNotificationProvider = ({ children }: { children: ReactNode }) => {
  const [notifications, setNotifications] = useState<GlobalNotification[]>([]);
  const [seenNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    const manager = getBroadcastManager();
    
    const handleBroadcast = (event: NotificationBroadcast) => {
      if (event.type === 'dismiss') {
        // Remove dismissed notification
        setNotifications((prev) => prev.filter((n) => n.id !== event.id));
        return;
      }

      // Don't duplicate notifications from the same tab
      if (seenNotifications.has(event.id + event.timestamp)) {
        return;
      }

      const notification: GlobalNotification = {
        ...event,
        id: event.id,
        type: event.type as any,
      };

      // Add notification
      setNotifications((prev) => [notification, ...prev].slice(0, 10));
      seenNotifications.add(event.id + event.timestamp);

      // Trigger audio/haptic feedback
      if (event.type === 'manual-order') {
        playAlertSound();
        vibrateManualOrder();
        // Show system notification
        showManualOrderNotification({
          title: event.title,
          body: event.body,
          tag: `manual-order-${event.data?.orderId}`,
          url: '/driver/active',
        });
      } else if (event.type === 'message') {
        playMessageSound();
        vibrateMessage();
        // Show system notification
        showMessageNotification({
          title: event.title,
          body: event.body,
          tag: `message-${event.data?.messageId}`,
          url: '/driver/chat',
        });
      } else if (event.type === 'admin-alert') {
        playAlertSound();
      }
    };

    // Subscribe to broadcast notifications
    const unsubscribe = manager.subscribe(handleBroadcast);

    return () => {
      unsubscribe();
    };
  }, [seenNotifications]);

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    // Broadcast dismiss to other tabs
    const manager = getBroadcastManager();
    manager.broadcast({
      type: 'dismiss',
      id,
      timestamp: Date.now(),
    });
  };

  return (
    <NotificationContext.Provider value={{ notifications, dismissNotification }}>
      {children}
    </NotificationContext.Provider>
  );
};

/**
 * Hook to use global notifications
 */
export const useGlobalNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useGlobalNotifications must be used within GlobalNotificationProvider'
    );
  }
  return context;
};
