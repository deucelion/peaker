import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import {
  DataTable,
  DataTablePagination,
  DataTableToolbar,
  uiTableRowClass,
  uiTableRowHoverClass,
  uiTableTdClass,
  uiTableThClass,
} from "@/components/ui/data-display";
import { Loader2 } from "lucide-react";

const meta = {
  title: "Branding/Tables/Wave 11",
  parameters: {
    layout: "centered",
  },
} satisfies Meta;

export default meta;

type Story = StoryObj;

const sampleRows = [
  { id: "1", name: "Alpha FC", count: 12, created: "01.03.2026" },
  { id: "2", name: "Beta Academy", count: 8, created: "15.02.2026" },
  { id: "3", name: "Gamma Elite", count: 21, created: "22.01.2026" },
];

function BasicTableDemo() {
  return (
    <DataTable
      className="w-full max-w-2xl"
      caption="Takım listesi"
      headClassName="ui-table-head ui-table-head--filled"
      head={
        <tr>
          <th className={uiTableThClass}>Takım</th>
          <th className={uiTableThClass}>Sporcu</th>
          <th className={uiTableThClass}>Oluşturulma</th>
        </tr>
      }
    >
      {sampleRows.map((row) => (
        <tr key={row.id} className={uiTableRowHoverClass}>
          <td className={uiTableTdClass}>{row.name}</td>
          <td className={`${uiTableTdClass} tabular-nums`}>{row.count}</td>
          <td className={uiTableTdClass}>{row.created}</td>
        </tr>
      ))}
    </DataTable>
  );
}

export const BasicTable: Story = {
  render: () => <BasicTableDemo />,
};

export const DenseTable: Story = {
  render: () => (
    <DataTable
      className="w-full max-w-2xl"
      tableClassName="text-[10px]"
      headClassName="ui-table-head ui-table-head--divided"
      head={
        <tr>
          <th className={`${uiTableThClass} py-1`}>Takım</th>
          <th className={`${uiTableThClass} py-1`}>Sporcu</th>
          <th className={`${uiTableThClass} py-1`}>Oluşturulma</th>
        </tr>
      }
    >
      {sampleRows.map((row) => (
        <tr key={row.id} className={uiTableRowHoverClass}>
          <td className={`${uiTableTdClass} py-1.5`}>{row.name}</td>
          <td className={`${uiTableTdClass} py-1.5 tabular-nums`}>{row.count}</td>
          <td className={`${uiTableTdClass} py-1.5`}>{row.created}</td>
        </tr>
      ))}
    </DataTable>
  ),
};

export const SelectableRows: Story = {
  render: () => {
    const [selectedId, setSelectedId] = useState("2");
    return (
      <DataTable
        className="w-full max-w-2xl"
        headClassName="ui-table-head ui-table-head--filled"
        head={
          <tr>
            <th className={uiTableThClass}>Takım</th>
            <th className={uiTableThClass}>Durum</th>
          </tr>
        }
      >
        {sampleRows.map((row) => (
          <tr
            key={row.id}
            role="button"
            tabIndex={0}
            onClick={() => setSelectedId(row.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSelectedId(row.id);
              }
            }}
            className={`${uiTableRowHoverClass} cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--peaker-ui-PRIMARY)_40%,transparent)] ${
              selectedId === row.id ? "ui-table-row--selected" : uiTableRowClass
            }`}
          >
            <td className={uiTableTdClass}>{row.name}</td>
            <td className={uiTableTdClass}>{selectedId === row.id ? "Seçili" : "—"}</td>
          </tr>
        ))}
      </DataTable>
    );
  },
};

export const StickyHeader: Story = {
  render: () => (
    <DataTable
      className="w-full max-w-2xl"
      stickyHeader
      scrollClassName="max-h-48 overflow-y-auto ui-table-scroll"
      headClassName="ui-table-head ui-table-head--filled"
      head={
        <tr>
          <th className={uiTableThClass}>Takım</th>
          <th className={uiTableThClass}>Sporcu</th>
        </tr>
      }
    >
      {Array.from({ length: 12 }, (_, i) => (
        <tr key={i} className={uiTableRowHoverClass}>
          <td className={uiTableTdClass}>Takım {i + 1}</td>
          <td className={`${uiTableTdClass} tabular-nums`}>{i + 3}</td>
        </tr>
      ))}
    </DataTable>
  ),
};

export const Loading: Story = {
  render: () => (
    <DataTable className="w-full max-w-2xl" layout="records" caption="Kayıtlar">
      <div className="flex items-center gap-3 px-4 py-10 text-[10px] font-black uppercase tracking-widest text-gray-500">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Yükleniyor…
      </div>
    </DataTable>
  ),
};

export const Empty: Story = {
  render: () => (
    <DataTable
      className="w-full max-w-2xl"
      headClassName="ui-table-head ui-table-head--filled"
      head={
        <tr>
          <th className={uiTableThClass}>Takım</th>
          <th className={uiTableThClass}>Sporcu</th>
        </tr>
      }
    >
      <tr>
        <td colSpan={2} className="p-10 text-center text-[10px] font-black uppercase tracking-widest text-gray-500">
          Henüz kayıt yok
        </td>
      </tr>
    </DataTable>
  ),
};

export const Toolbar: Story = {
  render: () => (
    <div className="w-full max-w-2xl space-y-4">
      <DataTableToolbar
        actions={
          <button type="button" className="ui-btn-primary">
            Dışa aktar
          </button>
        }
      >
        <input className="ui-input max-w-xs" placeholder="Ara…" aria-label="Tablo arama" />
        <button type="button" className="ui-btn-ghost">
          Filtrele
        </button>
      </DataTableToolbar>
      <BasicTableDemo />
    </div>
  ),
};

export const Pagination: Story = {
  render: () => {
    const [page, setPage] = useState(2);
    return (
      <DataTable
        className="w-full max-w-2xl"
        caption="Sayfalı tablo"
        footer={<DataTablePagination page={page} pageSize={10} total={48} onChange={setPage} />}
        headClassName="ui-table-head ui-table-head--filled"
        head={
          <tr>
            <th className={uiTableThClass}>Takım</th>
            <th className={uiTableThClass}>Sporcu</th>
          </tr>
        }
      >
        {sampleRows.map((row) => (
          <tr key={row.id} className={uiTableRowHoverClass}>
            <td className={uiTableTdClass}>{row.name}</td>
            <td className={`${uiTableTdClass} tabular-nums`}>{row.count}</td>
          </tr>
        ))}
      </DataTable>
    );
  },
};
