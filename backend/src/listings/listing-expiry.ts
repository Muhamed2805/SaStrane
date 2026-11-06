import { ListingStatus } from '../generated/prisma/enums.js';

// An open job stays open this long, counted from posting, reopening or
// extending.
export const LISTING_LIFETIME_DAYS = 30;
// The client is told this long before the job expires.
export const EXPIRY_REMINDER_DAYS = 3;

const DAY_MS = 24 * 60 * 60_000;

export function daysFrom(now: Date, days: number) {
  return new Date(now.getTime() + days * DAY_MS);
}

// The expiry fields for a job that is opened or closed now. An open job
// gets a new lifetime; a closed one has none.
export function expiryFor(status: ListingStatus, now = new Date()) {
  return {
    expiresAt:
      status === ListingStatus.OPEN
        ? daysFrom(now, LISTING_LIFETIME_DAYS)
        : null,
    expiryReminderSentAt: null,
  };
}
