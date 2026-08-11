import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { FinanceFilterDrawer } from "@/components/finance/FinanceFilterDrawer";
import { TahsilatRecordSheet } from "@/components/finance/TahsilatRecordSheet";
import { SyncStatusCenter } from "@/components/offline/SyncStatusCenter";
import type { OfflineQueuedAction } from "@/lib/offline/types";

const meta = {
  title: "Branding/Overlay/Wave 9 Drawers",
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

export const RightDrawer: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button type="button" className="ui-btn-primary m-4" onClick={() => setOpen(true)}>
          Open filter drawer
        </button>
        <FinanceFilterDrawer
          open={open}
          onClose={() => setOpen(false)}
          onApply={() => undefined}
          onReset={() => undefined}
        >
          <p className="text-xs text-gray-400">Finance filter fields placeholder.</p>
        </FinanceFilterDrawer>
      </>
    );
  },
};

export const BottomSheet: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button type="button" className="ui-btn-primary m-4" onClick={() => setOpen(true)}>
          Open tahsilat sheet
        </button>
        <TahsilatRecordSheet
          open={open}
          organizationIdFromUrl={null}
          athletes={[]}
          resetKey={0}
          busy={false}
          onBusyChange={() => undefined}
          onClose={() => setOpen(false)}
          onError={() => undefined}
          onSuccess={() => undefined}
        />
      </>
    );
  },
};

const offlineItems: OfflineQueuedAction[] = [
  {
    id: "offline-1",
    kind: "attendance_draft",
    risk: "safe",
    title: "Yoklama kaydı",
    subjectLabel: "Grup dersi · 10:00",
    status: "pending",
    scopeKey: "org:demo",
    createdAt: new Date().toISOString(),
    lastAttemptAt: null,
    lastError: null,
    retries: 0,
    navigationHref: null,
    payload: {},
  },
];

export const OfflineSyncStatusCenter: Story = {
  render: () => {
    const [open, setOpen] = useState(true);
    return (
      <>
        <button type="button" className="ui-btn-primary m-4" onClick={() => setOpen(true)}>
          Open sync center
        </button>
        <SyncStatusCenter
          open={open}
          onClose={() => setOpen(false)}
          items={offlineItems}
          scopeKey="org:demo"
          syncing={false}
          lastResult={null}
          onRetry={() => undefined}
          onRefresh={() => undefined}
          onRetryOne={() => undefined}
        />
      </>
    );
  },
};
