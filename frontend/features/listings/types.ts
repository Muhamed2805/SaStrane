export type Listing = {
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