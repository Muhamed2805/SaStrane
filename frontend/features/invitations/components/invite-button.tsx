'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { InviteDialog } from './invite-dialog';

type InviteButtonProps = {
  executorId: string;
  executorName: string;
};

// On a public profile of a user who does jobs. Hidden on the user's own
// profile. A signed-out visitor is asked to sign in first.
export function InviteButton({ executorId, executorName }: InviteButtonProps) {
  const { user, openAuthModal } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);

  if (user?.id === executorId) return null;

  return (
    <div className="mt-6 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Treba ti ovakva pomoć? Pošalji poziv na svoj otvoreni oglas.
      </p>
      <button
        type="button"
        onClick={() => (user ? setIsOpen(true) : openAuthModal())}
        className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary/90"
      >
        <Send className="size-4" aria-hidden="true" />
        Pozovi na oglas
      </button>
      {isOpen && user ? (
        <InviteDialog
          userId={user.id}
          executorId={executorId}
          executorName={executorName}
          onClose={() => setIsOpen(false)}
        />
      ) : null}
    </div>
  );
}
