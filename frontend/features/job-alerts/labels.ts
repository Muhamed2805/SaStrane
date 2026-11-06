import {
  CATEGORY_LABELS,
  LOCATION_LABELS,
} from '@/features/listings/constants';
import type { JobAlert } from './api';

// "Selidbe · Tuzla", "Selidbe · sve lokacije", "Svi poslovi · Tuzla".
export function jobAlertLabel(alert: Pick<JobAlert, 'category' | 'location'>) {
  const category = alert.category
    ? CATEGORY_LABELS[alert.category]
    : 'Svi poslovi';
  const location = alert.location
    ? LOCATION_LABELS[alert.location]
    : 'sve lokacije';
  return `${category} · ${location}`;
}

// Whether an alert is for exactly these filters.
export function isAlertFor(
  alert: Pick<JobAlert, 'category' | 'location'>,
  filters: { category?: string | null; location?: string | null },
) {
  return (
    alert.category === (filters.category ?? null) &&
    alert.location === (filters.location ?? null)
  );
}
