import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell } from "@/components/qc/AppShell";
import { qcQueries, insertRow, deleteRow, uploadInstruksi } from "@/lib/qc";
import { InstruksiImage } from "@/components/qc/InstruksiImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/master")({
  head: () => ({
    meta: [
      { title: "Master Data QC — Produk, Standard & Defect" },
      {
        name: "description",
        content:
          "Kelola produk, standard dimensi/visual/fungsi, inspector, akun PIC, dan jenis defect untuk sistem inspeksi kualitas.",
      },
      { property: "og:title", content: "Master Data QC Inspect" },
      {
        property: "og:description",
        content: "Kelola produk, standard pengecekan, inspector, dan jenis defect.",
      },
    ],
  }),
  component: MasterPage,
});

const TABS = [
  { key: "produk", label: "Produk" },
  { key: "dimensi", label: "Standard Dimensi" },
  { key: "visual", label: "Standard Visual" },
  { key: "fungsi", label: "Standard Fungsi" },
  { key: "inspector", label: "Inspector" },
  { key: "pic", label: "Akun PIC" },
  { key: "defect", label: "Jenis Defect" },
] as const;

function Panel({ children }: { children: React.ReactNode }) {
  return <section className="rounded-lg border border-border bg-card p-5">{children}</section>;
}

function DataTable({
  headers,
  rows,
  onDelete,
}: {
  headers: string[];
  rows: { id: string; cells: React.ReactNode[] }[];
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-muted-foreground">
          <tr className="border-b border-border">
            {headers.map((h) => (
              <th key={h} className="py-2 pr-3 font-medium">
                {h}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-border/60">
              {r.cells.map((c, idx) => (
                <td key={idx} className="py-2 pr-3">
                  {c}
                </td>
              ))}
              <td className="py-2">
                <Button size="sm" variant="ghost" onClick={() => onDelete(r.id)}>
                  Hapus
                </Button>
              </td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={headers.length + 1} className="py-4 text-muted-foreground">
                Belum ada data.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MasterPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("produk");
  const [form, setForm] = useState<Record<string, string>>({});
  const [gambar, setGambar] = useState<File | null>(null);

  const products = useQuery(qcQueries.products());
  const inspectors = useQuery(qcQueries.inspectors());
  const defects = useQuery(qcQueries.defects());
  const dimStd = useQuery(qcQueries.dimensionStandards());
  const visStd = useQuery(qcQueries.visualStandards());
  const funStd = useQuery(qcQueries.functionStandards());
  const pics = useQuery({
    queryKey: ["pic_accounts"],
    queryFn: async () => {
      const { data, error } = await import("@/integrations/supabase/client").then((m) =>
        m.supabase.from("pic_accounts").select("*").order("nama"),
      );
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async ({ table, values }: { table: string; values: Record<string, unknown> }) => {
      await insertRow(table, values);
      return table;
    },
    onSuccess: (table) => {
      toast.success("Data ditambahkan");
      setForm({});
      setGambar(null);
      qc.invalidateQueries({ queryKey: [table] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async ({ table, id }: { table: string; id: string }) => {
      await deleteRow(table, id);
      return table;
    },
    onSuccess: (table) => qc.invalidateQueries({ queryKey: [table] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (name: string, label: string, type = "text") => (
    <div key={name}>
      <Label className="text-xs">{label}</Label>
      <Input
        type={type}
        step="any"
        value={form[name] ?? ""}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      />
    </div>
  );

  const productSelect = (name: string) => (
    <div key={name}>
      <Label className="text-xs">Produk</Label>
      <select
        className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        value={form[name] ?? products.data?.[0]?.id ?? ""}
        onChange={(e) => setForm({ ...form, [name]: e.target.value })}
      >
        {(products.data ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.kode} — {p.nama}
          </option>
        ))}
      </select>
    </div>
  );

  const gambarField = (
    <div key="gambar">
      <Label className="text-xs">Gambar Instruksi (opsional)</Label>
      <Input
        type="file"
        accept="image/*"
        onChange={(e) => setGambar(e.target.files?.[0] ?? null)}
      />
    </div>
  );

  const productName = (id: string) => products.data?.find((p) => p.id === id)?.nama ?? "—";

  return (
    <AppShell title="Master Data" subtitle="Kelola produk, standard, inspector, dan defect">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setForm({});
              setGambar(null);
            }}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              tab === t.key ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "produk" && (
        <>
          <Panel>
            <form
              className="grid items-end gap-4 sm:grid-cols-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const gambar_path = gambar ? await uploadInstruksi(gambar) : "";
                add.mutate({
                  table: "products",
                  values: { kode: form["kode"], nama: form["nama"], gambar_path },
                });
              }}
            >
              {field("kode", "Kode Produk")}
              {field("nama", "Nama Produk")}
              {gambarField}
              <Button type="submit">Tambah Produk</Button>
            </form>
          </Panel>
          <Panel>
            <DataTable
              headers={["Gambar", "Kode", "Nama Produk"]}
              rows={(products.data ?? []).map((p) => ({
                id: p.id,
                cells: [
                  <InstruksiImage key="g" path={p.gambar_path} alt={p.nama} />,
                  p.kode,
                  p.nama,
                ],
              }))}
              onDelete={(id) => del.mutate({ table: "products", id })}
            />
          </Panel>
        </>
      )}

      {tab === "dimensi" && (
        <>
          <Panel>
            <form
              className="grid items-end gap-4 sm:grid-cols-3"
              onSubmit={async (e) => {
                e.preventDefault();
                add.mutate({
                  table: "dimension_standards",
                  values: {
                    product_id: form["product_id"] ?? products.data?.[0]?.id,
                    parameter: form["parameter"],
                    satuan: form["satuan"] || "mm",
                    nilai_standar: Number(form["nilai_standar"] ?? 0),
                    toleransi_min: Number(form["toleransi_min"] ?? 0),
                    toleransi_max: Number(form["toleransi_max"] ?? 0),
                  },
                });
              }}
            >
              {productSelect("product_id")}
              {field("parameter", "Nama Parameter")}
              {field("satuan", "Satuan")}
              {field("nilai_standar", "Nilai Standar", "number")}
              {field("toleransi_min", "Toleransi −", "number")}
              {field("toleransi_max", "Toleransi +", "number")}
              <Button type="submit">Tambah Standard</Button>
            </form>
          </Panel>
          <Panel>
            <DataTable
              headers={["Produk", "Parameter", "Nilai", "Toleransi", "Satuan"]}
              rows={(dimStd.data ?? []).map((s) => ({
                id: s.id,
                cells: [
                  productName(s.product_id),
                  s.parameter,
                  Number(s.nilai_standar),
                  `−${Number(s.toleransi_min)} / +${Number(s.toleransi_max)}`,
                  s.satuan,
                ],
              }))}
              onDelete={(id) => del.mutate({ table: "dimension_standards", id })}
            />
          </Panel>
        </>
      )}

      {(tab === "visual" || tab === "fungsi") && (
        <>
          <Panel>
            <form
              className="grid items-end gap-4 sm:grid-cols-3"
              onSubmit={async (e) => {
                e.preventDefault();
                add.mutate({
                  table: tab === "visual" ? "visual_standards" : "function_standards",
                  values: {
                    product_id: form["product_id"] ?? products.data?.[0]?.id,
                    checklist: form["checklist"],
                  },
                });
              }}
            >
              {productSelect("product_id")}
              {field("checklist", "Nama Checklist")}
              <Button type="submit">Tambah Standard</Button>
            </form>
          </Panel>
          <Panel>
            <DataTable
              headers={["Produk", "Checklist"]}
              rows={((tab === "visual" ? visStd.data : funStd.data) ?? []).map((s) => ({
                id: s.id,
                cells: [
                  productName(s.product_id),
                  s.checklist,
                ],
              }))}
              onDelete={(id) =>
                del.mutate({
                  table: tab === "visual" ? "visual_standards" : "function_standards",
                  id,
                })
              }
            />
          </Panel>
        </>
      )}

      {tab === "inspector" && (
        <>
          <Panel>
            <form
              className="grid items-end gap-4 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate({
                  table: "inspectors",
                  values: {
                    nama: form["nama"],
                    dept: form["dept"] ?? "",
                    nomor_wa: form["nomor_wa"] ?? "",
                  },
                });
              }}
            >
              {field("nama", "Nama Inspector")}
              {field("dept", "Departemen")}
              {field("nomor_wa", "Nomor WhatsApp (08xx)")}
              <Button type="submit">Tambah Inspector</Button>
            </form>
          </Panel>
          <Panel>
            <DataTable
              headers={["Nama", "Departemen", "WhatsApp"]}
              rows={(inspectors.data ?? []).map((i) => ({
                id: i.id,
                cells: [i.nama, i.dept, i.nomor_wa ?? "—"],
              }))}
              onDelete={(id) => del.mutate({ table: "inspectors", id })}
            />
          </Panel>
        </>
      )}

      {tab === "pic" && (
        <>
          <Panel>
            <form
              className="grid items-end gap-4 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate({
                  table: "pic_accounts",
                  values: {
                    nama: form["nama"],
                    role: form["role"] ?? "input",
                    nomor_wa: form["nomor_wa"] ?? "",
                  },
                });
              }}
            >
              {field("nama", "Nama PIC")}
              {field("nomor_wa", "Nomor WhatsApp (08xx)")}
              <div>
                <Label className="text-xs">Peran</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={form["role"] ?? "input"}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  <option value="input">PIC Input</option>
                  <option value="view">PIC Lihat Saja</option>
                  <option value="approve">PIC Approve</option>
                </select>
              </div>
              <Button type="submit">Tambah Akun PIC</Button>
            </form>
          </Panel>
          <Panel>
            <DataTable
              headers={["Nama", "Peran", "WhatsApp"]}
              rows={(pics.data ?? []).map((p) => ({
                id: p.id as string,
                cells: [p.nama as string, p.role as string, (p.nomor_wa as string) || "—"],
              }))}
              onDelete={(id) => del.mutate({ table: "pic_accounts", id })}
            />
          </Panel>
        </>
      )}

      {tab === "defect" && (
        <>
          <Panel>
            <form
              className="grid items-end gap-4 sm:grid-cols-4"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate({
                  table: "defects",
                  values: {
                    nama: form["nama"],
                    tipe: form["tipe"] ?? "Dimensi",
                    kategori: form["kategori"] ?? "Minor",
                  },
                });
              }}
            >
              {field("nama", "Nama Defect")}
              <div>
                <Label className="text-xs">Tipe</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={form["tipe"] ?? "Dimensi"}
                  onChange={(e) => setForm({ ...form, tipe: e.target.value })}
                >
                  {["Dimensi", "Visual", "Fungsi"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs">Kategori</Label>
                <select
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={form["kategori"] ?? "Minor"}
                  onChange={(e) => setForm({ ...form, kategori: e.target.value })}
                >
                  {["Minor", "Mayor", "Kritis"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <Button type="submit">Tambah Defect</Button>
            </form>
          </Panel>
          <Panel>
            <DataTable
              headers={["Nama", "Tipe", "Kategori"]}
              rows={(defects.data ?? []).map((d) => ({
                id: d.id,
                cells: [d.nama, d.tipe, d.kategori],
              }))}
              onDelete={(id) => del.mutate({ table: "defects", id })}
            />
          </Panel>
        </>
      )}
    </AppShell>
  );
}
