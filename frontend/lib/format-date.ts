const MONTHS_BS = [
  'januar',
  'februar',
  'mart',
  'april',
  'maj',
  'juni',
  'juli',
  'august',
  'septembar',
  'oktobar',
  'novembar',
  'decembar',
];

// Intl.DateTimeFormat('bs-BA', { month: 'long' }) falls back to a garbled
// format in many browsers (incomplete ICU data for Bosnian), so months are
// spelled out manually here instead of relying on locale formatting.
export function formatDate(dateInput: string | Date) {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return `${date.getDate()}. ${MONTHS_BS[date.getMonth()]} ${date.getFullYear()}.`;
}
