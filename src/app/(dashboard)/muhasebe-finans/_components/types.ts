// Muhasebe & Finans sayfası alt component'leri için ortak tipler.
// Faz 4.1 — UI parçalama için ekstrakt edildi; iş mantığı parent (page.tsx) içinde.

export type ViewTab = "genel" | "alacak" | "koclar";

export type GeneralFiltersState = {
  month: string;
  dateFrom: string;
  dateTo: string;
  coachId: string;
  lessonType: string;
  lessonStatus: string;
  paymentKind: string;
  paymentStatus: string;
  packageLifecycle: string;
  packagePaymentState: string;
};

export type ReceivableFiltersState = {
  month: string;
  dateFrom: string;
  dateTo: string;
  athleteId: string;
  team: string;
  packageLifecycle: string;
  pkgPaymentStatus: string;
  receivableState: string;
};

export type CoachesFiltersState = {
  month: string;
  dateFrom: string;
  dateTo: string;
  coachId: string;
  lessonType: string;
  lessonStatus: string;
};

export type CoachOption = { id: string; full_name: string };

export type FilterDropdownOption = { value: string; label: string };
