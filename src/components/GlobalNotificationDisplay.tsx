import { useGlobalNotifications } from '../contexts/NotificationContext';
import { NotificationToast } from './NotificationToast';

/**
 * Global notification display component that works across all pages
 * Should be placed at the root of the app
 */
export const GlobalNotificationDisplay = () => {
  const { notifications, dismissNotification } = useGlobalNotifications();

  return (
    <NotificationToast
      notifications={notifications.map((n) => ({
        id: n.id,
        type: n.type as 'manual-order' | 'message' | 'info' | 'admin-alert',
        title: n.title || 'تنبيه',
        body: n.body || '',
        timestamp: n.timestamp,
        data: n.data,
      }))}
      onDismiss={dismissNotification}
    />
  );
};
