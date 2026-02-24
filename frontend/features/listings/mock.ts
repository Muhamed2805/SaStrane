import type { Listing } from "./types";

export const MOCK_LISTINGS: Listing[] = [
  {
    id: "1",
    title: "Košenje trave u dvorištu (Vogošća)",
    category: "Košenje trave",
    location: "Sarajevo",
    budgetText: "30–50 KM",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
  },
  {
    id: "2",
    title: "Pranje auta - unutra + vani",
    category: "Pranje auta",
    location: "Ilidža",
    budgetText: "25 KM",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    id: "3",
    title: "Pomoć oko selidbe (2 sata)",
    category: "Selidbe",
    location: "Sarajevo",
    budgetText: "20 KM/h",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
  },
  {
    id: "4",
    title: "Instalacija Windows + basic setup",
    category: "IT pomoć",
    location: "Stup",
    budgetText: "40 KM",
    createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
  },
];