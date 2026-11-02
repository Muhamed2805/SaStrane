// Prices are whole KM. Null means the price is agreed later.
//
// The thousands separator is added by hand: Intl number formats for bs-BA
// differ between Node and browsers, and the server and client must render
// the same text.
export function formatPrice(amount: number | null | undefined) {
  if (amount == null) return 'Po dogovoru';
  const digits = String(Math.trunc(amount)).replace(
    /\B(?=(\d{3})+(?!\d))/g,
    '.',
  );
  return `${digits} KM`;
}

// Reads a price input. An empty field means the price is agreed later.
export function parsePrice(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : Number(trimmed);
}
