'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { useApplicationsStore } from '@/features/applications/store';
import { initializeSession } from '@/features/auth/session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const userId = useAuthStore((state) => state.user?.id);
  const syncAppliedIds = useApplicationsStore((state) => state.syncAppliedIds);
  const resetApplications = useApplicationsStore((state) => state.reset);

  useEffect(() => {
    void initializeSession();
  }, []);

  useEffect(() => {
    if (userId) {
      syncAppliedIds();
    } else {
      resetApplications();
    }
  }, [userId, syncAppliedIds, resetApplications]);

  return <>{children}</>;
}
