import { useEffect, useState } from 'react';

// Three discrete scale steps: normal, large, extra-large. The picked value is
// persisted in localStorage so the driver's preference survives refreshes.
//
// Implementation note: we apply this scale via CSS `zoom` on the driver
// content wrapper. `zoom` proportionally scales every text node, icon, and
// touch target inside without us having to rewrite Tailwind classes one by
// one — which is what we want for accessibility (everything bigger, not just
// the body copy). `zoom` is supported in Chrome / WebView / Safari and
// Firefox (since v126), which covers every Android phone in use.

export type TextScale = 1 | 1.15 | 1.3;

const STORAGE_KEY = 'driver_text_scale';
const STEPS: TextScale[] = [1, 1.15, 1.3];

export const TEXT_SCALE_LABELS: Record<TextScale, string> = {
  1: 'حجم عادي',
  1.15: 'حجم كبير',
  1.3: 'حجم أكبر',
};

const readStored = (): TextScale => {
  if (typeof window === 'undefined') return 1;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  const parsed = raw ? Number(raw) : 1;
  return (STEPS as number[]).includes(parsed) ? (parsed as TextScale) : 1;
};

export const useTextScale = () => {
  const [scale, setScale] = useState<TextScale>(readStored);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(scale));
    } catch {
      // ignore quota / privacy errors
    }
  }, [scale]);

  // Cycle: 1 → 1.15 → 1.3 → 1
  const cycle = () => {
    setScale(prev => {
      const idx = STEPS.indexOf(prev);
      return STEPS[(idx + 1) % STEPS.length];
    });
  };

  return { scale, setScale, cycle, label: TEXT_SCALE_LABELS[scale] };
};
