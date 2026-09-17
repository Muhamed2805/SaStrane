'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BriefcaseBusiness, HeartHandshake, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';

export default function LoginPage() {
  const router = useRouter();
  const { user, openAuthModal } = useAuthStore();

  useEffect(() => {
    if (user) {
      router.replace('/profile');
      return;
    }
    openAuthModal();
  }, [openAuthModal, router, user]);

  return (
    <div className="mx-auto max-w-3xl py-10 text-center sm:py-16">
      <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <HeartHandshake className="size-8" aria-hidden="true" />
      </div>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">
        Dobro došao na SaStrane
      </h1>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
        Prijavi se ili kreiraj račun kako bi objavljivao poslove, slao prijave i
        upravljao svojom aktivnošću.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-white p-6 text-left shadow-sm">
          <BriefcaseBusiness
            className="size-6 text-primary"
            aria-hidden="true"
          />
          <h2 className="mt-4 font-bold">Pronađi lokalni posao</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Pregledaj oglase i predstavi klijentu svoje iskustvo i ponudu.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-6 text-left shadow-sm">
          <ShieldCheck className="size-6 text-primary" aria-hidden="true" />
          <h2 className="mt-4 font-bold">Upravljaj na jednom mjestu</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Prati oglase, poslane prijave i ponude zainteresovanih izvođača.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={openAuthModal}
        className="mt-8 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primary/90"
      >
        Otvori prijavu
      </button>
    </div>
  );
}
