"use client";

import EmptyState from "@/components/ui/EmptyState";

type EmptyStateAction = {
  label: string;
  onClick?: () => void;
  href?: string;
};

/**
 * @deprecated Use {@link EmptyState} from `@/components/ui/EmptyState` instead.
 * This wrapper redirects to the unified EmptyState component (Wave 13).
 */
export default function EmptyStateCard({
  title = "Kayıt bulunamadı",
  description,
  reason,
  primaryAction,
  secondaryAction,
  compact = false,
}: {
  title?: string;
  description: string;
  reason?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  compact?: boolean;
}) {
  return (
    <EmptyState
      variant="no_data"
      title={title}
      description={description}
      reason={reason}
      primaryAction={primaryAction}
      secondaryAction={secondaryAction}
      compact={compact}
    />
  );
}
