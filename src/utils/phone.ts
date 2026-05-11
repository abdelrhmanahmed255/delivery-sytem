import type { ClipboardEventHandler } from 'react';

// Egyptian phone number normalization helpers.
//
// WhatsApp / international clipboards often produce numbers like:
//   "+20 12 7479 3771", "0020 1274793771", "+201274793771"
// While the local DB stores the 11-digit local form: "01274793771".
// These helpers convert any of those representations into the canonical
// 11-digit local Egyptian form so search / matching work reliably.

/**
 * Normalize an Egyptian phone number to the 11-digit local form (e.g. 01XXXXXXXXX).
 * If the input cannot be confidently mapped to a phone (too short, etc.) the
 * digits-only version is returned unchanged.
 */
export const normalizeEgyptPhone = (input: string): string => {
  if (!input) return '';
  let digits = input.replace(/\D/g, '');
  if (!digits) return '';

  // 0020XXXXXXXXXX → 20XXXXXXXXXX (drop international "00" prefix)
  if (digits.startsWith('00')) digits = digits.slice(2);

  // 20 1XXXXXXXXX (12 digits, EG country code) → 01XXXXXXXXX
  if (digits.startsWith('20') && digits.length === 12) {
    digits = '0' + digits.slice(2);
  }
  // 1XXXXXXXXX (10 digits, missing leading 0) → 01XXXXXXXXX
  else if (digits.length === 10 && /^[125]/.test(digits)) {
    digits = '0' + digits;
  }

  return digits;
};

/**
 * Normalize the input only when it looks like a phone number
 * (digits with optional +, spaces, dashes, parentheses). Otherwise
 * it is returned untouched so names / addresses are not mangled.
 */
export const normalizeIfPhoneLike = (input: string): string => {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return input;
  // "Phone-like" = starts with + or digit, contains only phone characters.
  const phoneLike = /^[+\d][\d\s\-+()]*$/.test(trimmed);
  if (!phoneLike) return input;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 5) return input;
  return normalizeEgyptPhone(trimmed);
};

/**
 * React onPaste handler factory: if the pasted text looks like a phone
 * number, the field value is replaced with the normalized form. Used in
 * search inputs and phone fields so a WhatsApp copy works out of the box.
 */
export const handlePhonePaste = (
  setter: (value: string) => void
): ClipboardEventHandler<HTMLInputElement> => (e) => {
  const pasted = e.clipboardData.getData('text');
  if (!pasted) return;
  const normalized = normalizeIfPhoneLike(pasted);
  if (normalized !== pasted) {
    e.preventDefault();
    setter(normalized);
  }
};
