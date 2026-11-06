'use client';

import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { AuthUser } from '@/features/auth/api';
import { updateSessionUser } from '@/features/auth/session';
import { accountApi } from '../api';

// Emails about applications and messages. Security emails, such as a
// password change notice, are always sent.
export function NotificationSettings({ user }: { user: AuthUser }) {
  const save = useMutation({
    mutationFn: (emailNotifications: boolean) =>
      accountApi.updateProfile({ emailNotifications }),
    onSuccess: (updated) => {
      updateSessionUser(updated);
      toast.success(
        updated.emailNotifications
          ? 'Email obavijesti su uključene.'
          : 'Email obavijesti su isključene.',
      );
    },
    onError: (error) => toast.error(error.message),
  });

  // Shows the choice at once, while it is saved.
  const enabled = save.isPending
    ? (save.variables ?? user.emailNotifications)
    : user.emailNotifications;

  return (
    <section
      aria-labelledby="notification-settings-heading"
      className="rounded-2xl border bg-card p-6 shadow-sm"
    >
      <h2 id="notification-settings-heading" className="text-lg font-bold">
        Obavijesti
      </h2>

      <div className="mt-5 flex items-start justify-between gap-6">
        <div>
          <p id="email-notifications-label" className="text-sm font-semibold">
            Email obavijesti
          </p>
          <p
            id="email-notifications-description"
            className="mt-1 text-sm text-muted-foreground"
          >
            Email za novu prijavu na tvoj oglas, odgovor na tvoju prijavu i
            poruke koje nisu pročitane 10 minuta. Sigurnosni emailovi, kao
            obavijest o promjeni lozinke, uvijek se šalju.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-labelledby="email-notifications-label"
          aria-describedby="email-notifications-description"
          disabled={save.isPending}
          onClick={() => save.mutate(!enabled)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-primary/30 focus-visible:outline-none disabled:opacity-60 ${
            enabled ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            aria-hidden="true"
            className={`inline-block size-5 rounded-full bg-white shadow-sm transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
    </section>
  );
}
