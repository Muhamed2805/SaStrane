// Totals for the admin overview. "New" means created in the last 7 days.
export class AdminStatsDto {
  users!: number;

  newUsers!: number;

  suspendedUsers!: number;

  openListings!: number;

  closedListings!: number;

  newListings!: number;

  applications!: number;

  newApplications!: number;

  openReports!: number;
}
