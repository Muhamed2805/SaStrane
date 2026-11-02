'use client';

import { useEffect } from 'react';
import { initializeSession } from '@/features/auth/session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initializeSession();
  }, []);

  return <>{children}</>;
}
