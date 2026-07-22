'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { listingsApi } from '@/features/listings/api';
import { applicationsApi } from '@/features/applications/api';
import { formatDate } from '@/lib/format-date';

const ROLE_LABEL: Record<string, string> = {
  CLIENT: 'Klijent',
  EXECUTOR: 'Izvršilac',
  BOTH: 'Klijent i izvršilac',
};

export default function ProfilePage() {
  const { user, token } = useAuthStore();
  const [listingsCount, setListingsCount] = useState<number | null>(null);
  const [applicationsCount, setApplicationsCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !token) return;

    Promise.all([
      listingsApi.getAll({ clientId: user.id, limit: 1 }),
      applicationsApi.getMyApplications(token),
    ])
      .then(([listingsPage, applications]) => {
        setListingsCount(listingsPage.total);
        setApplicationsCount(applications.length);
      })
      .catch((err) => setError((err as Error).message));
  }, [user, token]);

  if (!user) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Moraš biti prijavljen da vidiš profil.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Profil</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tvoji podaci i aktivnost.</p>
      </div>

      <div className="rounded-lg border p-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="text-lg font-semibold">{user.fullName}</div>
            <div className="text-sm text-muted-foreground">{user.email}</div>
          </div>
        </div>

        <dl className="mt-4 space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Uloga</dt>
            <dd>{ROLE_LABEL[user.role] ?? user.role}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Član od</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          Greška: {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold">{listingsCount ?? '—'}</div>
          <div className="mt-1 text-sm text-muted-foreground">Objavljenih oglasa</div>
        </div>
        <div className="rounded-lg border p-4 text-center">
          <div className="text-2xl font-bold">{applicationsCount ?? '—'}</div>
          <div className="mt-1 text-sm text-muted-foreground">Poslanih prijava</div>
        </div>
      </div>
    </div>
  );
}
