import type { PaymentRow } from "@/types/domain";
import type { PrivateLessonPackage, PrivateLessonPayment } from "@/lib/types/privateLesson";

export type FinanceStatusTone = "overdue" | "approaching" | "paid";

export interface FinanceStatusSummary {
  tone: FinanceStatusTone;
  label:
    | "Ödeme Tamamlandı"
    | "Ödeme Bekleniyor"
    | "Kısmi Ödeme Var"
    | "Gecikmiş Ödeme Var"
    | "Borç Bulunmuyor";
  nextDueDate: string | null;
  nextAmount: number | null;
  overdueCount: number;
  pendingCount: number;
}

export interface AthleteFinanceDetail {
  athlete: {
    id: string;
    fullName: string;
    number: string | null;
    position: string | null;
    team: string | null;
  };
  summary: FinanceStatusSummary;
  aidatPayments: PaymentRow[];
  legacyPackagePayments: PaymentRow[];
  privateLessonPackages: PrivateLessonPackage[];
  privateLessonPayments: PrivateLessonPayment[];
  totals: {
    aidatPaidTotal: number;
    aidatPendingTotal: number;
    privateLessonPaidTotal: number;
  };
  nextAidatPlan: {
    dueDate: string | null;
    amount: number | null;
  };
}
