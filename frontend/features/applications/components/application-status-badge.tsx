import type { ApplicationStatus } from '../api';

const STATUS_LABELS: Record<ApplicationStatus, string> = {
  PENDING: 'Na čekanju',
  ACCEPTED: 'Prihvaćeno',
  REJECTED: 'Odbijeno',
};

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-800',
  ACCEPTED: 'border-green-200 bg-green-50 text-green-800',
  REJECTED: 'border-red-200 bg-red-50 text-red-800',
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
