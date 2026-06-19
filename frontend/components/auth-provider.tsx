'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { useApplicationsStore } from '@/features/applications/store';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const restoreSession = useAuthStore((state) => state.restoreSession);
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const syncAppliedIds = useApplicationsStore((state) => state.syncAppliedIds);
  const resetApplications = useApplicationsStore((state) => state.reset);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (user && token) {
      syncAppliedIds(token);
    } else {
      resetApplications();
    }
  }, [user, token, syncAppliedIds, resetApplications]);

  return <>{children}</>;
}
