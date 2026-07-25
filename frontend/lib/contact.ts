// Shared contact-field metadata + the phone mask, used by both the add form and
// the "suggest an edit" dialog so the two stay in lockstep.

export type ContactKey = 'phone' | 'email' | 'website' | 'contact_name' | 'social_link';

// Live US-style phone mask: format digits as the user types so the expected
// shape is obvious. Dependency-free and lenient — strip to digits, drop a
// leading US country code, cap at 10 digits. (The backend stores free text.)
export function formatUsPhone(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length === 0) return '';
  if (digits.length < 4) return `(${digits}`;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export const CONTACT_FIELDS: {
  key: ContactKey;
  label: string;
  placeholder: string;
  type?: string;
  inputMode?: 'tel' | 'email' | 'url';
  maxLength: number;
  // Optional live formatter applied on each keystroke (e.g. the phone mask).
  format?: (value: string) => string;
}[] = [
  { key: 'phone', label: 'Phone', placeholder: '(555) 123-4567', type: 'tel', inputMode: 'tel', maxLength: 40, format: formatUsPhone },
  { key: 'email', label: 'Email', placeholder: 'name@example.com', type: 'email', inputMode: 'email', maxLength: 200 },
  // No type="url" on the link fields: native URL validation rejects bare domains
  // like "joesplumbing.com", but the backend prepends https:// for us. inputMode
  // still gives mobile users the URL keyboard.
  { key: 'website', label: 'Website', placeholder: 'joesplumbing.com', inputMode: 'url', maxLength: 300 },
  { key: 'contact_name', label: 'Who to ask for', placeholder: 'e.g. Joe', maxLength: 120 },
  { key: 'social_link', label: 'Social link', placeholder: 'facebook.com/…', inputMode: 'url', maxLength: 300 },
];
