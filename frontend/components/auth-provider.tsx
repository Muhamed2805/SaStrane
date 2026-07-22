'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/features/auth/store';
import { useApplicationsStore } from '@/features/applications/store';

const SILENT_REFRESH_INTERVAL_MS = 10 * 60 * 1000; // access token expires after 15m

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

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      useAuthStore.getState().refreshAccessToken().catch(() => {
        // refresh token is invalid/expired — clear the session
        useAuthStore.getState().logout();
      });
    }, SILENT_REFRESH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [token]);

  return <>{children}</>;
}
