import { apiClient } from './client';

/** One thread in the summary (last message is from a driver — pending admin reply). */
export interface ChatSummaryThread {
  driver_id: number;
  thread_id: number;
  driver_name: string;
  driver_email: string;
  last_message_id: number;
  last_message_preview: string;
  last_message_at: string;
}

/** Response from GET /admin/notifications/driver-chat/summary */
export interface ChatSummary {
  pending_thread_count: number;
  threads: ChatSummaryThread[];
}

/** One item returned by the poll endpoint (driver-originated message). */
export interface ChatPollMessage {
  id: number;
  thread_id: number;
  driver_id: number;
  body: string;
  created_at: string;
}

export const adminNotificationsApi = {
  /**
   * GET /admin/notifications/driver-chat/summary
   * Badge counts + inbox-style thread list. All returned threads have their
   * last message sent by a driver (= pending admin attention).
   */
  getSummary: (params?: { limit?: number; offset?: number }): Promise<ChatSummary> =>
    apiClient.get('/admin/notifications/driver-chat/summary', { params }).then(r => r.data),

  /**
   * GET /admin/notifications/driver-chat/poll?since_message_id=N
   * Incremental new driver-message detection.  Frontend keeps a cursor
   * (`since_message_id`) and advances it to max(messages[].id) after each call.
   */
  poll: (sinceMessageId: number, limit = 50): Promise<{ messages: ChatPollMessage[] }> =>
    apiClient.get('/admin/notifications/driver-chat/poll', {
      params: { since_message_id: sinceMessageId, limit },
    }).then(r => r.data),
};
