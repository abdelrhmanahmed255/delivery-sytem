import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { driversApi } from '../api/drivers';
import { useAuthStore } from '../store/authStore';

/** Send a heartbeat every 30 seconds (safely above any reasonable backend minimum). */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * After 3 HOURS of genuine zero user interaction we auto-disable availability
 * and close presence. Drivers regularly lock their phone screen or switch
 * apps for long stretches while waiting for offers; they must NOT be kicked
 * offline for that. The timer only fires after a real 3-hour idle window —
 * see the wall-clock guard inside `goOfflineDueToInactivity`.
 *
 * NOTE: this is the ONLY automatic offline trigger from the frontend.
 * We intentionally do NOT close presence on refresh / tab close / route
 * change — the driver should stay online across page reloads. The backend
 * still has a stale-presence safety net (driver_presence_stale_seconds)
 * if the driver disappears without sending heartbeats, but we proactively
 * re-open presence the moment the tab returns to the foreground so a
 * locked phone screen never produces a lingering "offline" state.
 */
const INACTIVITY_TIMEOUT_MS = 3 * 60 * 60 * 1000; // 3 hours

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
  // Wall-clock timestamp of the last real user activity / visibility-resume.
  // Used to defend against `setTimeout` firing immediately when a mobile tab
  // wakes up after the OS suspended it (the queued timer can fire all at once
  // even though no real idle time elapsed in our app while suspended).
  const lastActivityAtRef = useRef<number>(Date.now());

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
      // Wall-clock guard: NEVER take the driver offline unless a full
      // INACTIVITY_TIMEOUT_MS of real time has elapsed since the last
      // recorded activity. If a backgrounded mobile tab resumes and the
      // queued timer fires early, we just reschedule for the remainder.
      const idleFor = Date.now() - lastActivityAtRef.current;
      if (idleFor < INACTIVITY_TIMEOUT_MS) {
        const remaining = INACTIVITY_TIMEOUT_MS - idleFor;
        if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = setTimeout(goOfflineDueToInactivity, remaining);
        return;
      }
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
      lastActivityAtRef.current = Date.now();
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(goOfflineDueToInactivity, INACTIVITY_TIMEOUT_MS);
    };

    // ── 1. Open presence session ─────────────────────────────────────────────
    // Safe to call on every mount: it only flips presence_status to
    // online_idle and updates last_seen_at; it does NOT touch is_available.
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
    // When the tab becomes visible again (phone unlocked, app returned to
    // foreground after multitasking, etc.) mobile browsers will have paused
    // our heartbeat interval, so the backend almost certainly considers the
    // driver stale by now. We immediately re-open the presence session to
    // restore presence_status=online_idle and refresh last_seen_at, then
    // invalidate the cached profile so the UI flips back to online without
    // the user having to refresh.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        resetInactivityTimer();
        driversApi.presenceOpen().catch(() => {});
        queryClient.invalidateQueries({ queryKey: ['driverMe'] });
      } else {
        // App going to background — tell backend we're still here but idle.
        sendHeartbeat(false);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // We intentionally do NOT register beforeunload / pagehide handlers
    // and do NOT call presenceClose() in the cleanup below. Doing either
    // would set is_available=false on every page refresh, which kicks the
    // driver out of the offer pool. Explicit logout (DriverLayout's
    // handleLogout) is responsible for closing presence properly.

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      ACTIVITY_EVENTS.forEach(ev =>
        window.removeEventListener(ev, resetInactivityTimer)
      );
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, queryClient]);
}
