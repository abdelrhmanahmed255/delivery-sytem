import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { driverOrdersApi } from '../api/driverOrders';
import { driversApi } from '../api/drivers';
import { apiClient } from '../api/client';
import {
  broadcastManualOrderNotification,
  broadcastMessageNotification,
} from '../utils/broadcastNotifications';
import {
  showOfferNotification,
  playAlertSound,
  playMessageSound,
  vibrateManualOrder,
  vibrateMessage,
  showMessageNotification,
} from '../utils/notifications';

/** How often to re-fire the system notification while an offer is pending */
const NOTIFY_REPEAT_INTERVAL_MS = 12_000;
/** How often to re-beep / re-vibrate while an offer is pending */
const ALARM_REPEAT_INTERVAL_MS = 2_500;
/** How often to re-play the message sound while unread messages exist */
const MESSAGE_REMINDER_INTERVAL_MS = 10_000;

/**
 * Hook that monitors for new manual orders and broadcasts notifications to all tabs
 */
export const useManualOrderNotifications = () => {
  const previousOrdersRef = useRef<Set<number>>(new Set());

  const { data: orders } = useQuery({
    queryKey: ['activeOrdersForNotifications'],
    queryFn: () => driverOrdersApi.activeOrders(),
    refetchInterval: 8000, // Poll frequently to catch new manual orders
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!orders || orders.length === 0) return;

    orders.forEach((order: any) => {
      // Check if this is a new manual order
      if (
        !previousOrdersRef.current.has(order.id) &&
        order.distribution_mode === 'manual' &&
        order.status === 'in_progress'
      ) {
        previousOrdersRef.current.add(order.id);

        // Broadcast to all tabs
        broadcastManualOrderNotification(
          order.id,
          order.code,
          order.price,
          order.customer?.address || order.pickup_address || 'عنوان غير محدد',
          order.delivery_eta_minutes || 30
        );
      }
    });
  }, [orders]);
};

/**
 * Hook that monitors for new messages and broadcasts notifications.
 *
 * When the driver is NOT on the chat page, it keeps playing a reminder sound
 * every 10 seconds so the driver knows they have unread messages.
 * The alarm stops when they navigate to /driver/chat.
 *
 * Returns { hasUnread } so the layout can show a badge on the chat tab.
 */
export const useMessageNotifications = () => {
  const previousMessagesRef = useRef<Map<number, string>>(new Map());
  const lastMessageCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef(true);
  const [hasUnread, setHasUnread] = useState(false);
  const location = useLocation();
  const isOnChatPage = location.pathname === '/driver/chat';

  // Fetch chat messages to detect new ones
  const { data: messages } = useQuery({
    queryKey: ['driverChatMessagesForNotifications'],
    queryFn: () => driversApi.getMyChatMessages({ limit: 50 }),
    refetchInterval: 6000, // Poll every 6 seconds
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    const TEN_MINUTES_MS = 10 * 60 * 1000;
    const now = Date.now();
    const currentMessageIds = new Set<number>();
    let foundNew = false;
    
    // Check for new messages (ones we haven't seen before)
    messages.forEach((msg: any) => {
      currentMessageIds.add(msg.id);

      // If we haven't seen this message before, it's new
      if (!previousMessagesRef.current.has(msg.id)) {
        previousMessagesRef.current.set(msg.id, msg.body);

        // Only care about messages from admin
        if (msg.from_user?.id !== msg.from_user_id) {
          if (isFirstLoadRef.current) {
            // On first load: only notify if the message is from the last 10 minutes
            const msgTime = msg.created_at ? new Date(msg.created_at).getTime() : 0;
            if (now - msgTime <= TEN_MINUTES_MS) {
              foundNew = true;
              broadcastMessageNotification(
                msg.id,
                msg.from_user?.full_name || 'الإدارة',
                msg.body || 'رسالة جديدة'
              );
            }
          } else {
            // After first load: any new admin message triggers notification
            foundNew = true;
            broadcastMessageNotification(
              msg.id,
              msg.from_user?.full_name || 'الإدارة',
              msg.body || 'رسالة جديدة'
            );
          }
        }
      }
    });

    if (foundNew && !isOnChatPage) {
      setHasUnread(true);
    }

    isFirstLoadRef.current = false;

    // Clean up old messages that are no longer in the list
    for (const msgId of previousMessagesRef.current.keys()) {
      if (!currentMessageIds.has(msgId)) {
        previousMessagesRef.current.delete(msgId);
      }
    }

    lastMessageCountRef.current = messages.length;
  }, [messages, isOnChatPage]);

  // Clear unread flag when driver opens chat
  useEffect(() => {
    if (isOnChatPage) {
      setHasUnread(false);
    }
  }, [isOnChatPage]);

  // Repeating message reminder — play sound + vibrate every 10s while
  // there are unread messages and the driver is NOT on the chat page.
  useEffect(() => {
    if (isOnChatPage || !hasUnread) return;

    const playReminder = () => {
      if (!hasUnread) return;
      playMessageSound();
      vibrateMessage();
      // Also re-fire the system notification so it stays in the shade
      showMessageNotification({
        title: '💬 لديك رسائل غير مقروءة',
        body: 'اضغط لفتح المحادثة مع الإدارة',
        tag: 'unread-messages-reminder',
        url: '/driver/chat',
      });
    };

    // Don't fire immediately — the initial broadcast already played sound
    const id = setInterval(playReminder, MESSAGE_REMINDER_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isOnChatPage, hasUnread, messages]);

  return { hasUnread };
};

/**
 * Hook that polls for new delivery offers and triggers system notifications,
 * sound alerts, and vibration from ANY driver page.
 *
 * This ensures the driver gets alerted even if they are on the chat, profile,
 * history, or active-orders tab — not just the home/offers page.
 *
 * Returns the current offer summary (if any) so DriverHome can still use
 * it to show the offer card UI.
 */
export const useOfferNotifications = () => {
  const lastNotifiedOfferRef = useRef<number | null>(null);

  const { data: offerSummary } = useQuery({
    queryKey: ['currentOffer'],
    queryFn: () => apiClient.get('/driver/orders/current-offer').then(r => r.data),
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
  });

  const pendingOfferId: number | undefined =
    offerSummary?.id ?? offerSummary?.offer_id ?? offerSummary?.order_offer_id;

  // ── System-tray notification: fire on new offer, repeat every 12s ──
  useEffect(() => {
    if (!pendingOfferId) {
      lastNotifiedOfferRef.current = null;
      return;
    }

    const price = offerSummary?.price ?? offerSummary?.order?.price;
    const area =
      offerSummary?.customer?.address ?? offerSummary?.order?.customer?.address ?? '';

    const fireNotification = () => {
      showOfferNotification({
        title: '🔔 طلب توصيل جديد!',
        body: price
          ? `المبلغ ${price} ج.م${area ? ` — ${area}` : ''} — اضغط لعرض التفاصيل`
          : 'لديك عرض توصيل جديد — اضغط لعرض التفاصيل',
        tag: `driver-offer-${pendingOfferId}`,
        url: '/driver/home',
      });
    };

    fireNotification();
    const id = setInterval(fireNotification, NOTIFY_REPEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pendingOfferId, offerSummary]);

  // ── In-page audible beep + device vibration while offer is pending ──
  useEffect(() => {
    if (!pendingOfferId) return;

    const playBeep = () => {
      playAlertSound();
      vibrateManualOrder();
    };

    playBeep();
    const id = setInterval(playBeep, ALARM_REPEAT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pendingOfferId]);

  return { offerSummary, pendingOfferId };
};
