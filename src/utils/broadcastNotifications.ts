/**
 * Cross-tab notification system using BroadcastChannel API
 * Allows all tabs to receive and display notifications for manual orders and messages
 */

export type NotificationEventType = 'manual-order' | 'message' | 'dismiss';

export interface NotificationBroadcast {
  type: NotificationEventType;
  id: string;
  title?: string;
  body?: string;
  timestamp: number;
  data?: Record<string, any>;
}

class BroadcastNotificationManager {
  private channel: BroadcastChannel | null = null;
  private listeners: Set<(event: NotificationBroadcast) => void> = new Set();

  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.channel = new BroadcastChannel('driver-notifications');
        this.channel.onmessage = (event) => {
          this.notifyListeners(event.data);
        };
      } catch (err) {
        console.warn('[BroadcastNotifications] BroadcastChannel not available', err);
      }
    }
  }

  /**
   * Broadcast a notification to all tabs
   */
  broadcast(notification: NotificationBroadcast): void {
    if (!this.channel) return;
    try {
      this.channel.postMessage(notification);
      // Also notify local listeners
      this.notifyListeners(notification);
    } catch (err) {
      console.warn('[BroadcastNotifications] Failed to broadcast', err);
    }
  }

  /**
   * Subscribe to notifications
   */
  subscribe(listener: (event: NotificationBroadcast) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all local listeners
   */
  private notifyListeners(notification: NotificationBroadcast): void {
    this.listeners.forEach((listener) => {
      try {
        listener(notification);
      } catch (err) {
        console.error('[BroadcastNotifications] Listener error', err);
      }
    });
  }

  /**
   * Close the broadcast channel
   */
  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }
}

// Singleton instance
let managerInstance: BroadcastNotificationManager | null = null;

export const getBroadcastManager = (): BroadcastNotificationManager => {
  if (!managerInstance) {
    managerInstance = new BroadcastNotificationManager();
  }
  return managerInstance;
};

/**
 * Broadcast a manual order notification to all tabs
 */
export const broadcastManualOrderNotification = (
  orderId: number,
  code: string,
  price: number,
  address: string,
  eta: number
): void => {
  const manager = getBroadcastManager();
  manager.broadcast({
    type: 'manual-order',
    id: `manual-order-${orderId}`,
    title: `🔴 طلب تعيين جديد `,
    body: `${price} ج.م${address ? ` — ${address}` : ''} (${eta} دقيقة)`,
    timestamp: Date.now(),
    data: {
      orderId,
      code,
      price,
      address,
      eta,
    },
  });
};

/**
 * Broadcast a message notification to all tabs
 */
export const broadcastMessageNotification = (
  messageId: number | string,
  senderName: string,
  messagePreview: string
): void => {
  const manager = getBroadcastManager();
  manager.broadcast({
    type: 'message',
    id: `message-${messageId}`,
    title: `💬 رسالة من ${senderName}`,
    body: messagePreview,
    timestamp: Date.now(),
    data: {
      messageId,
      senderName,
    },
  });
};

/**
 * Broadcast dismiss notification
 */
export const broadcastDismissNotification = (notificationId: string): void => {
  const manager = getBroadcastManager();
  manager.broadcast({
    type: 'dismiss',
    id: notificationId,
    timestamp: Date.now(),
  });
};
