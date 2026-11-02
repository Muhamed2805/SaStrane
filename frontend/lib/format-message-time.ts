import { formatDate } from './format-date';

const MONTHS_SHORT_BS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'maj',
  'jun',
  'jul',
  'aug',
  'sep',
  'okt',
  'nov',
  'dec',
];

function toDate(input: string | Date) {
  return typeof input === 'string' ? new Date(input) : input;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Whole calendar days from date to now: 0 is today, 1 is yesterday.
function daysAgo(date: Date, now: Date) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS,
  );
}

export function formatClockTime(input: string | Date) {
  const date = toDate(input);
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getHours()}:${minutes}`;
}

// For a conversation list: the time today, "jučer", or a short date.
export function formatMessageTime(input: string | Date, now = new Date()) {
  const date = toDate(input);
  const days = daysAgo(date, now);
  if (days <= 0) return formatClockTime(date);
  if (days === 1) return 'jučer';
  const day = `${date.getDate()}. ${MONTHS_SHORT_BS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear()
    ? day
    : `${day} ${date.getFullYear()}.`;
}

// For the separators between the days of a conversation.
export function formatMessageDay(input: string | Date, now = new Date()) {
  const date = toDate(input);
  const days = daysAgo(date, now);
  if (days <= 0) return 'Danas';
  if (days === 1) return 'Jučer';
  return formatDate(date);
}

export function isSameDay(a: string | Date, b: string | Date) {
  return startOfDay(toDate(a)).getTime() === startOfDay(toDate(b)).getTime();
}
