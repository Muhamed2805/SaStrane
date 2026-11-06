'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { ReportDialog } from './report-dialog';

type ReportButtonProps = {
  target: { listingId: string } | { userId: string };
  // The user who would be reported: hidden for them.
  ownerId: string;
  // The job title or the user's name, shown in the dialog.
  subject: string;
};

// A signed-out visitor is asked to sign in first.
export function ReportButton({ target, ownerId, subject }: ReportButtonProps) {
  const { user, openAuthModal } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  if (user?.id === ownerId) return null;

  const label = 'listingId' in target ? 'Prijavi oglas' : 'Prijavi korisnika';

  return (
    <>
      <button
        type="button"
        onClick={() => (user ? setIsOpen(true) : openAuthModal())}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-red-600"
      >
        <Flag className="size-3.5" aria-hidden="true" />
        {label}
      </button>
      {isOpen ? (
        <ReportDialog
          target={target}
          title={label}
          subject={subject}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}
