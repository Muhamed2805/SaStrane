const DAY_MS = 24 * 60 * 60_000;

// The owner sees the extend button this many days before the job expires.
export const EXTEND_WINDOW_DAYS = 7;

// Whole days until the job expires, rounded up: 0 once it is past.
export function daysLeft(expiresAt: string, now = new Date()) {
  return Math.max(
    0,
    Math.ceil((Date.parse(expiresAt) - now.getTime()) / DAY_MS),
  );
}

// "Ističe danas", "Ističe sutra", "Ističe za 3 dana", "Ističe za 21 dan".
export function expiryLabel(expiresAt: string, now = new Date()) {
  const days = daysLeft(expiresAt, now);
  if (days === 0) return 'Ističe danas';
  if (days === 1) return 'Ističe sutra';
  const unit = days % 10 === 1 && days % 100 !== 11 ? 'dan' : 'dana';
  return `Ističe za ${days} ${unit}`;
}

// An open job close to its expiry, which the owner may want to extend.
export function isExpiringSoon(
  listing: { status: string; expiresAt: string | null },
  now = new Date(),
) {
  return (
    listing.status === 'OPEN' &&
    listing.expiresAt !== null &&
    daysLeft(listing.expiresAt, now) <= EXTEND_WINDOW_DAYS
  );
}
