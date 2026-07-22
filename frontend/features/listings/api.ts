import { API_URL } from '@/lib/api-url';

export type ListingFromApi = {
  id: string;
  title: string;
  category: string;
  location: string;
  budget: string | null;
  description?: string | null;
  createdAt: string;
  client: {
    id: string;
    fullName: string;
  };
};

export type ListingsPage = {
  items: ListingFromApi[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type GetAllListingsParams = {
  page?: number;
  limit?: number;
  clientId?: string;
};

export type CreateListingPayload = {
  title: string;
  category: string;
  location: string;
  budget?: string;
  description?: string;
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

export const listingsApi = {
  getAll: (params: GetAllListingsParams = {}) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.clientId) searchParams.set('clientId', params.clientId);
    const query = searchParams.toString();
    return request<ListingsPage>(`/listings${query ? `?${query}` : ''}`);
  },

  getById: (id: string) => request<ListingFromApi>(`/listings/${id}`),

  create: (payload: CreateListingPayload, token: string) =>
    request<ListingFromApi>('/listings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    }),

  delete: (id: string, token: string) =>
    request<void>(`/listings/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }),
};