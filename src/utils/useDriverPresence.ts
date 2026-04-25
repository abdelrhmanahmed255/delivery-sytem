import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { driversApi } from '../api/drivers';
import { useAuthStore } from '../store/authStore';

/** Send a heartbeat every 25 seconds (safely above any reasonable backend minimum). */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * After 15 minutes of zero user interaction, auto-disable availability and
 * close presence so the driver is removed from the offer pool immediately.
 * The UI updates automatically because we invalidate the driverMe query.
 */
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

/** DOM events that count as "user is interacting" — covers both desktop and mobile */
const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'touchstart', 'touchend', 'touchmove',
  'scroll', 'click',
] as const;

export function useDriverPresence() {
  const token = useAuthStore(state => state.token);
  const queryClient = useQueryClient();

  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!token) return;

    // ── helpers ──────────────────────────────────────────────────────────────
    const sendHeartbeat = (isInteracting: boolean) => {
      driversApi.presenceHeartbeat(isInteracting).catch((err) => {
        // 400 = throttled by backend — expected, not fatal
        if (err?.response?.status !== 400) {
          console.warn('[Presence] heartbeat error', err?.response?.status);
        }
      });
    };

    const goOfflineDueToInactivity = async () => {
      try {
        // Disable availability first so backend removes driver from offer pool
        await driversApi.setAvailability(false);
        await driversApi.presenceClose();
      } catch {
        // best effort
      }
      // Invalidate the cached driver profile so every component that reads
      // is_available / presence_status refreshes immediately — no page reload needed
      queryClient.invalidateQueries({ queryKey: ['driverMe'] });
    };

    const resetInactivityTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(goOfflineDueToInactivity, INACTIVITY_TIMEOUT_MS);
    };

    // ── 1. Open presence session ─────────────────────────────────────────────
    driversApi.presenceOpen().catch(() => {});

    // ── 2. Periodic heartbeat ────────────────────────────────────────────────
    heartbeatTimerRef.current = setInterval(() => {
      sendHeartbeat(document.visibilityState === 'visible');
    }, HEARTBEAT_INTERVAL_MS);

    // ── 3. Inactivity tracking ───────────────────────────────────────────────
    resetInactivityTimer();
    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, resetInactivityTimer, { passive: true })
    );

    // ── 4. Visibility change ─────────────────────────────────────────────────
    const handleVisibilityChange = () => {
      sendHeartbeat(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ── 5. Best-effort close on tab/browser close ────────────────────────────
    // 'pagehide' is more reliable than 'beforeunload' on iOS Safari.
    const sendPresenceClose = () => {
      const base = (import.meta.env.VITE_API_URL as string) || '/api';
      fetch(`${base}/drivers/me/presence/close`, {
        method: 'POST',
        keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', sendPresenceClose);
    window.addEventListener('pagehide', sendPresenceClose);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      ACTIVITY_EVENTS.forEach(ev =>
        window.removeEventListener(ev, resetInactivityTimer)
      );
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', sendPresenceClose);
      window.removeEventListener('pagehide', sendPresenceClose);
      driversApi.presenceClose().catch(() => {});
    };
  }, [token, queryClient]);
}

