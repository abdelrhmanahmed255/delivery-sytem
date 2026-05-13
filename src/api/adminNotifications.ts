import { apiClient } from './client';

export interface ChatThread {
  driver_id: number;
  driver_name: string;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_type: 'driver' | 'admin' | null;
}

export const adminNotificationsApi = {
  /** GET /admin/chat/threads — all driver chat threads with unread counts */
  getChatThreads: (): Promise<ChatThread[]> =>
    apiClient.get('/admin/chat/threads').then(r => r.data),

  /** POST /admin/drivers/:id/chat/read — mark a thread's messages as read */
  markThreadRead: (driverId: number): Promise<void> =>
    apiClient.post(`/admin/drivers/${driverId}/chat/read`).then(r => r.data),
};
