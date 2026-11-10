'use client';

import Link from 'next/link';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { AvatarSettings } from '@/features/account/components/avatar-settings';
import { DeleteAccount } from '@/features/account/components/delete-account';
import { JobAlertSettings } from '@/features/job-alerts/components/job-alert-settings';
import { NotificationSettings } from '@/features/account/components/notification-settings';
import { PasswordSettings } from '@/features/account/components/password-settings';
import { PortfolioSettings } from '@/features/portfolio/components/portfolio-settings';
import { ProfileSettings } from '@/features/account/components/profile-settings';
import { useAuthStore } from '@/features/auth/store';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsPage() {
  const { user, status, openAuthModal } = useAuthStore();

  if (status === 'loading') {
    return (
      <div className="mx-auto max-w-3xl space-y-6" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <section className="mx-auto flex max-w-xl flex-col items-center rounded-3xl border bg-card px-6 py-14 text-center shadow-sm sm:px-12">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <LockKeyhole className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">
          Prijavi se za pristup postavkama
        </h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
          Ovdje se mijenjaju profil, obavijesti i lozinka naloga.
        </p>
        <button
          type="button"
          onClick={openAuthModal}
          className="mt-7 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Prijavi se
        </button>
      </section>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Moj profil
        </Link>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Postavke naloga
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uredi podatke o profilu i obavijesti, promijeni lozinku ili obriši
          nalog.
        </p>
      </div>

      <AvatarSettings user={user} />
      {/* A change from another tab resets the form to the saved values. */}
      <ProfileSettings
        key={JSON.stringify([user.fullName, user.role, user.bio, user.skills])}
        user={user}
      />
      <PortfolioSettings userId={user.id} />
      <NotificationSettings user={user} />
      <JobAlertSettings userId={user.id} />
      <PasswordSettings />
      <DeleteAccount />
    </div>
  );
}
