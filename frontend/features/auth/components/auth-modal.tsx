'use client';

import { useState } from 'react';
import { useAuthStore } from '../store';

type Tab = 'login' | 'register';

export function AuthModal() {
  const { isAuthModalOpen, closeAuthModal, login, register, isLoading, error } = useAuthStore();

  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');

  if (!isAuthModalOpen) return null;

  const handleSubmit = async () => {
    if (tab === 'login') {
      await login({ email, password });
    } else {
      await register({ email, password, fullName, role: 'BOTH' });
    }
  };

  const switchTab = (t: Tab) => {
    setTab(t);
    setEmail('');
    setPassword('');
    setFullName('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={closeAuthModal} />

      <div className="relative z-10 w-full max-w-sm rounded-lg border bg-background p-5 shadow-lg">
        {/* Tabs */}
        <div className="mb-4 flex gap-2 border-b">
          <button
            className={`pb-2 text-sm font-medium ${tab === 'login' ? 'border-b-2 border-foreground' : 'text-muted-foreground'}`}
            onClick={() => switchTab('login')}
          >
            Prijava
          </button>
          <button
            className={`pb-2 text-sm font-medium ${tab === 'register' ? 'border-b-2 border-foreground' : 'text-muted-foreground'}`}
            onClick={() => switchTab('register')}
          >
            Registracija
          </button>
        </div>

        <div className="space-y-3">
          {tab === 'register' && (
            <input
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="Ime i prezime"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          )}

          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            className="h-10 w-full rounded-md border bg-background px-3 text-sm"
            placeholder="Lozinka"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            className="h-10 w-full rounded-md bg-black text-sm text-white hover:opacity-90 disabled:opacity-50"
            disabled={isLoading || !email || !password || (tab === 'register' && !fullName)}
            onClick={handleSubmit}
          >
            {isLoading ? 'Učitavanje...' : tab === 'login' ? 'Prijavi se' : 'Registruj se'}
          </button>

          <button
            className="h-10 w-full rounded-md border text-sm hover:bg-muted"
            onClick={closeAuthModal}
          >
            Otkaži
          </button>
        </div>
      </div>
    </div>
  );
}