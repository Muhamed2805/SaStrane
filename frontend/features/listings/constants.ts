import type { ListingCategory, ListingLocation } from "./api";

// The API stores fixed codes. These are the names the site shows.
export const CATEGORY_LABELS: Record<ListingCategory, string> = {
  LAWN_MOWING: "Košenje trave",
  CAR_WASH: "Pranje auta",
  MOVING: "Selidbe",
  IT_HELP: "IT pomoć",
  CLEANING: "Čišćenje",
  ASSEMBLY: "Montaža",
  DELIVERY: "Dostava",
  OTHER: "Ostalo",
};

export const LOCATION_LABELS: Record<ListingLocation, string> = {
  SARAJEVO: "Sarajevo",
  ILIDZA: "Ilidža",
  STUP: "Stup",
  VOGOSCA: "Vogošća",
  MOSTAR: "Mostar",
  BANJA_LUKA: "Banja Luka",
  TUZLA: "Tuzla",
  ZENICA: "Zenica",
};

export const LISTING_CATEGORIES = Object.keys(
  CATEGORY_LABELS,
) as ListingCategory[];

export const LISTING_LOCATIONS = Object.keys(
  LOCATION_LABELS,
) as ListingLocation[];

// The highest price the API accepts, in whole KM.
export const MAX_PRICE_KM = 100_000;

// For values from the URL, which can be anything.
export function isListingCategory(value: unknown): value is ListingCategory {
  return typeof value === "string" && Object.hasOwn(CATEGORY_LABELS, value);
}

export function isListingLocation(value: unknown): value is ListingLocation {
  return typeof value === "string" && Object.hasOwn(LOCATION_LABELS, value);
}
