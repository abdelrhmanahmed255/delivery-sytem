import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { driversApi } from '../api/drivers';
import { useAuthStore } from '../store/authStore';

/** Send a heartbeat every 30 seconds (safely above any reasonable backend minimum). */
const HEARTBEAT_INTERVAL_MS = 30_000;

/**
 * IMPORTANT POLICY (requested by product owner, May 2026):
 *
 * The driver's availability (`is_available`) must NEVER be turned off by the
 * frontend. It only flips when the driver taps the toggle themselves (or when
 * the admin / backend changes it explicitly).
 *
 * Historical context: we used to auto-disable availability after 3 hours of
 * zero user interaction. That behaviour caused drivers to silently go offline
 * while waiting for offers (locked phone screen, app in background, etc.) and
 * is now fully removed. The 3-hour inactivity timer below is commented out on
 * purpose — do NOT re-enable it without product approval.
 *
 * What we DO keep:
 *   • Heartbeats every 30s while the page is mounted, so the backend never
 *     considers the driver stale (`driver_presence_stale_seconds`).
 *   • Re-opening presence the moment the tab returns to the foreground after
 *     a phone unlock / app switch, so `presence_status` snaps back to
 *     `online_idle` immediately.
 *   • Explicit logout still calls `presence/close` — see DriverLayout.
 *
 * What we DO NOT do:
 *   • No `setAvailability(false)` on inactivity.
 *   • No `presenceClose()` on refresh / tab close / route change.
 *   • No `beforeunload` / `pagehide` handlers.
 */
// const INACTIVITY_TIMEOUT_MS = 3 * 60 * 60 * 1000; // (disabled) 3 hours

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
  // Wall-clock timestamp of the last real user activity / visibility-resume.
  // Currently only used to flag the next heartbeat as "interacting"; the
  // auto-offline timer that previously consumed this is disabled.
  const lastActivityAtRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!token) return;

    const sendHeartbeat = (isInteracting: boolean) => {
      driversApi.presenceHeartbeat(isInteracting).catch((err) => {
        if (err?.response?.status !== 400) {
          console.warn('[Presence] heartbeat error', err?.response?.status);
        }
      });
    };

    const markActivity = () => {
      lastActivityAtRef.current = Date.now();
    };

    // ── 1. Open presence session ─────────────────────────────────────────────
    // Safe to call on every mount: it only flips presence_status to
    // online_idle and updates last_seen_at; it does NOT touch is_available.
    driversApi.presenceOpen().catch(() => {});

    // ── 2. Periodic heartbeat ────────────────────────────────────────────────
    // Sends an "interacting" flag if the user touched the screen within the
    // last 60s; otherwise reports idle. Either way the backend resets
    // last_seen_at so the driver is never flagged stale while the tab is alive.
    heartbeatTimerRef.current = setInterval(() => {
      const recentlyInteracted = Date.now() - lastActivityAtRef.current < 60_000;
      const tabVisible = document.visibilityState === 'visible';
      sendHeartbeat(tabVisible && recentlyInteracted);
    }, HEARTBEAT_INTERVAL_MS);

    // ── 3. Activity tracking (now only updates the heartbeat flag) ───────────
    ACTIVITY_EVENTS.forEach(ev =>
      window.addEventListener(ev, markActivity, { passive: true })
    );

    // ── 4. Visibility change ─────────────────────────────────────────────────
    // When the tab becomes visible again (phone unlocked, app returned to
    // foreground after multitasking, etc.) mobile browsers will have paused
    // our heartbeat interval, so the backend may have considered the driver
    // stale. We immediately re-open the presence session to restore
    // presence_status=online_idle and refresh last_seen_at, then invalidate
    // the cached profile so the UI flips back to online without a refresh.
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markActivity();
        driversApi.presenceOpen().catch(() => {});
        // Fire an immediate heartbeat so the backend sees us within seconds,
        // not on the next 30s tick.
        sendHeartbeat(true);
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
      ACTIVITY_EVENTS.forEach(ev =>
        window.removeEventListener(ev, markActivity)
      );
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [token, queryClient]);
}
