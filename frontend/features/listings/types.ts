export type Listing = {
  id: string;
  title: string;
  category: string;
  location: string;
  budgetText?: string;
  createdAt: string; // ISO string
};