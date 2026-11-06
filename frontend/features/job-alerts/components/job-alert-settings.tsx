'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { BellRing, LoaderCircle, Trash2 } from 'lucide-react';
import { MAX_JOB_ALERTS } from '../api';
import { useRemoveJobAlert } from '../hooks';
import { jobAlertLabel } from '../labels';
import { jobAlertsQuery } from '../queries';

// The user's job alerts in the account settings. New ones are added on the
// job list, from its filters.
export function JobAlertSettings({ userId }: { userId: string }) {
  const alerts = useQuery(jobAlertsQuery(userId));
  const { remove, removingId } = useRemoveJobAlert(userId);

  return (
    <section
      aria-labelledby="job-alert-settings-heading"
      className="rounded-2xl border bg-card p-6 shadow-sm"
    >
      <h2 id="job-alert-settings-heading" className="text-lg font-bold">
        Upozorenja za nove oglase
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Za svaki nov oglas koji odgovara dobiješ obavijest, i email ako su email
        obavijesti uključene. Najviše {MAX_JOB_ALERTS} upozorenja.
      </p>

      {alerts.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Učitavam upozorenja...
        </p>
      ) : alerts.error ? (
        <p className="mt-5 text-sm text-red-600" role="alert">
          {alerts.error.message}
        </p>
      ) : alerts.data.length === 0 ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Još nemaš upozorenja. Na stranici{' '}
          <Link
            href="/listings"
            className="font-semibold text-primary hover:underline"
          >
            Pronađi posao
          </Link>{' '}
          izaberi vrstu posla ili lokaciju, pa klikni „Obavijesti me o novim
          oglasima”.
        </p>
      ) : (
        <ul className="mt-5 divide-y rounded-xl border">
          {alerts.data.map((alert) => {
            const label = jobAlertLabel(alert);
            const isRemoving = removingId === alert.id;
            return (
              <li
                key={alert.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <span className="flex items-center gap-2.5 text-sm font-medium">
                  <BellRing
                    className="size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  {label}
                </span>
                <button
                  type="button"
                  onClick={() => remove(alert.id)}
                  disabled={isRemoving}
                  aria-label={`Obriši upozorenje: ${label}`}
                  className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                >
                  {isRemoving ? (
                    <LoaderCircle
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <Trash2 className="size-4" aria-hidden="true" />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
