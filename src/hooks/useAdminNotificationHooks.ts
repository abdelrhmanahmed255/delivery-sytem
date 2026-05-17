import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ordersApi } from '../api/orders';
import { getBroadcastManager } from '../utils/broadcastNotifications';

// Add a specific broadcast type for admin alerts
export const broadcastAdminAlert = (title: string, body: string, type: 'admin-alert' | 'info' = 'admin-alert') => {
  const manager = getBroadcastManager();
  manager.broadcast({
    type: type as any,
    id: `admin-alert-${Date.now()}`,
    timestamp: Date.now(),
    title,
    body,
  });
};

/**
 * Hook that polls for orders that have been waiting for > 5 minutes
 * and haven't been taken by a driver yet.
 */
export const useAdminStaleOrderNotifications = () => {
  const previousAlertedOrdersRef = useRef<Set<number>>(new Set());

  // Poll today's orders every 30 seconds
  const { data } = useQuery({
    queryKey: ['admin-stale-orders'],
    queryFn: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      return ordersApi.list({
        from: start,
        to: end,
        limit: 200,
      });
    },
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!data?.items || data.items.length === 0) return;

    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    const now = Date.now();

    data.items.forEach((order: any) => {
      // We consider an order "waiting" if it's pending/offered,
      // or if it has no assigned driver, or hasn't been accepted yet.
      const isWaiting = ['pending', 'offered'].includes(order.status) || !order.assigned_driver || !order.accepted_at;

      if (isWaiting) {
        // Skip cancelled/completed/expired just in case
        if (['cancelled', 'completed', 'expired'].includes(order.status)) return;

        const createdAt = order.created_at ? new Date(order.created_at).getTime() : 0;

        if (createdAt > 0 && (now - createdAt) >= FIVE_MINUTES_MS) {
          if (!previousAlertedOrdersRef.current.has(order.id)) {
            previousAlertedOrdersRef.current.add(order.id);

            // Broadcast a toast to the admin
            broadcastAdminAlert(
              '⚠️ طلب متأخر!',
              `الطلب رقم ${order.customer?.full_name || order.id} ينتظر منذ أكثر من 5 دقائق ولم يتم تعيين مندوب له بعد.`,
              'admin-alert'
            );
          }
        }
      }
    });

  }, [data]);
};
