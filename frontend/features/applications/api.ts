const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ApplicationStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export type ApplicationFromApi = {
  id: string;
  listingId: string;
  message: string;
  proposedPrice: string | null;
  status: ApplicationStatus;
  createdAt: string;
  listing?: {
    title: string;
    category: string;
    location: string;
  };
  executor?: {
    id: string;
    fullName: string;
    email: string;
  };
};

export type CreateApplicationPayload = {
  listingId: string;
  message: string;
  proposedPrice?: string;
};

export type UpdateApplicationStatusPayload = {
  status: 'ACCEPTED' | 'REJECTED';
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Network error' }));
    throw new Error(error.message ?? 'Request failed');
  }

  return res.json();
}

export const applicationsApi = {
  apply: (payload: CreateApplicationPayload, token: string) =>
    request<ApplicationFromApi>('/applications', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),

  getMyApplications: (token: string) =>
    request<ApplicationFromApi[]>('/applications/my', {
      headers: { Authorization: `Bearer ${token}` },
    }),

  getForListing: (listingId: string, token: string) =>
    request<ApplicationFromApi[]>(`/applications/listing/${listingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),

  updateStatus: (id: string, payload: UpdateApplicationStatusPayload, token: string) =>
    request<ApplicationFromApi>(`/applications/${id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),
};
