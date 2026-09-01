import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { AppShell } from "@/components/qc/AppShell";
import {
  qcQueries,
  deleteRow,
  updateRow,
  SESI,
  SHIFTS,
  today,
  type Inspection,
} from "@/lib/qc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { downloadReportPdf, printReport } from "@/lib/report";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard QC Inspect — Ringkasan Inspeksi Kualitas" },
      {
        name: "description",
        content:
          "Pantau pass rate, akurasi dimensi, X-chart per parameter, dan riwayat inspeksi kualitas produk secara real-time.",
      },
      { property: "og:title", content: "Dashboard QC Inspect" },
      {
        property: "og:description",
        content: "Ringkasan hasil inspeksi kualitas produk: pass rate, defect, dan X-chart dimensi.",
      },
    ],
  }),
  component: Dashboard,
});

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className={`mt-1 text-2xl font-semibold ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Dashboard() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(qcQueries.products());
  const { data: inspectors = [] } = useQuery(qcQueries.inspectors());
  const { data: standards = [] } = useQuery(qcQueries.dimensionStandards());
  const { data: inspections = [] } = useQuery(qcQueries.inspections());

  const [chartProduct, setChartProduct] = useState("__ALL__");
  const [chartParam, setChartParam] = useState("__ALL__");
  const [range, setRange] = useState(30);
  const [tableProduct, setTableProduct] = useState("All");
  const [reportDate, setReportDate] = useState(today());
  const [reportShift, setReportShift] = useState("__ALL__");

  const productName = (id: string | null) =>
    products.find((p) => p.id === id)?.nama ?? "—";
  const inspectorName = (id: string | null) =>
    inspectors.find((i) => i.id === id)?.nama ?? "—";

  const total = inspections.length;
  const lulus = inspections.filter((i) => i.hasil_akhir === "Lulus").length;
  const gagal = total - lulus;
  const passRate = total ? Math.round((lulus / total) * 100) : 0;

  const dimensiPoints = useMemo(() => {
    const list: { tanggal: string; parameter: string; nilai: number; produk: string }[] = [];
    for (const insp of inspections) {
      for (const d of insp.dimensi?.detail ?? []) {
        if (typeof d.nilai === "number") {
          list.push({
            tanggal: insp.tanggal,
            parameter: d.parameter,
            nilai: d.nilai,
            produk: insp.product_id ?? "",
          });
        }
      }
    }
    return list.sort((a, b) => a.tanggal.localeCompare(b.tanggal));
  }, [inspections]);

  const akurasiDimensi = useMemo(() => {
    const all = inspections.flatMap((i) => i.dimensi?.detail ?? []);
    if (!all.length) return 0;
    return Math.round((all.filter((d) => d.hasil === "OK").length / all.length) * 100);
  }, [inspections]);

  const paramOptions = useMemo(() => {
    const rows = standards.filter(
      (s) => chartProduct === "__ALL__" || s.product_id === chartProduct,
    );
    return Array.from(new Set(rows.map((s) => s.parameter)));
  }, [standards, chartProduct]);

  const chartData = useMemo(() => {
    const limit =
      range > 0 ? new Date(Date.now() - range * 86400000).toISOString().slice(0, 10) : "";
    return dimensiPoints
      .filter((p) => chartProduct === "__ALL__" || p.produk === chartProduct)
      .filter((p) => chartParam === "__ALL__" || p.parameter === chartParam)
      .filter((p) => !limit || p.tanggal >= limit)
      .map((p) => ({ tanggal: p.tanggal, nilai: p.nilai }));
  }, [dimensiPoints, chartProduct, chartParam, range]);

  const activeStd = useMemo(() => {
    if (chartParam === "__ALL__") return null;
    return (
      standards.find(
        (s) =>
          s.parameter === chartParam &&
          (chartProduct === "__ALL__" || s.product_id === chartProduct),
      ) ?? null
    );
  }, [standards, chartParam, chartProduct]);

  const perProduct = useMemo(
    () =>
      products.map((p) => ({
        nama: p.nama,
        jumlah: inspections.filter((i) => i.product_id === p.id).length,
      })),
    [products, inspections],
  );

  const ngPerKategori = useMemo(
    () => [
      { label: "Dimensi", n: inspections.filter((i) => i.dimensi?.hasil === "NG").length },
      { label: "Visual", n: inspections.filter((i) => i.visual?.hasil === "NG").length },
      { label: "Fungsi", n: inspections.filter((i) => i.fungsi?.hasil === "NG").length },
    ],
    [inspections],
  );

  const todayStr = today();
  const sessionStatus = SHIFTS.flatMap((shift) =>
    SESI.map((sesi) => ({
      shift,
      sesi,
      done: inspections.some(
        (i) => i.tanggal === todayStr && i.shift === shift && i.sesi === sesi,
      ),
    })),
  );

  const filteredRows = inspections.filter(
    (i) => tableProduct === "All" || i.product_id === tableProduct,
  );

  const mutate = useMutation({
    mutationFn: async (fn: () => Promise<void>) => fn(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspections"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const maxBar = Math.max(1, ...perProduct.map((p) => p.jumlah));

  const reportRows = () =>
    filteredRows.map((i: Inspection) => ({
      inspection: i,
      produk: productName(i.product_id),
      inspector: inspectorName(i.inspector_id),
    }));

  // Laporan harian per tanggal & shift
  const dailyRows = useMemo(
    () =>
      inspections
        .filter((i) => i.tanggal === reportDate)
        .filter((i) => reportShift === "__ALL__" || i.shift === reportShift)
        .map((i) => ({
          inspection: i,
          produk: productName(i.product_id),
          inspector: inspectorName(i.inspector_id),
        })),
    [inspections, reportDate, reportShift, products, inspectors],
  );

  const dailyTitle = `Laporan Inspeksi ${reportDate}${
    reportShift === "__ALL__" ? " · Semua Shift" : ` · ${reportShift}`
  }`;

  const dailyLulus = dailyRows.filter((r) => r.inspection.hasil_akhir === "Lulus").length;
  const dailyGagal = dailyRows.length - dailyLulus;

  return (
    <AppShell title="Dashboard" subtitle="Ringkasan hasil inspeksi kualitas">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Total Inspeksi" value={String(total)} />
        <Stat label="Lulus" value={String(lulus)} tone="text-primary" />
        <Stat label="Gagal" value={String(gagal)} tone="text-destructive" />
        <Stat label="Pass Rate" value={`${passRate}%`} />
        <Stat label="Akurasi Dimensi" value={`${akurasiDimensi}%`} />
      </div>

      <Panel title="Kelengkapan Sesi Hari Ini">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {sessionStatus.map((s) => (
            <div
              key={`${s.shift}-${s.sesi}`}
              className={`rounded-md border p-3 text-xs ${
                s.done
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-muted/40 text-muted-foreground"
              }`}
            >
              <div className="font-medium">{s.shift}</div>
              <div>{s.sesi}</div>
              <div className="mt-1">{s.done ? "Selesai" : "Belum"}</div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Inspeksi per Produk">
          <div className="space-y-2">
            {perProduct.map((p) => (
              <div key={p.nama} className="text-xs">
                <div className="mb-1 flex justify-between">
                  <span>{p.nama}</span>
                  <span className="text-muted-foreground">{p.jumlah}</span>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div
                    className="h-2 rounded bg-primary"
                    style={{ width: `${(p.jumlah / maxBar) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {!perProduct.length && <p className="text-sm text-muted-foreground">Belum ada data.</p>}
          </div>
        </Panel>

        <Panel title="NG per Kategori Pengecekan">
          <div className="space-y-2">
            {ngPerKategori.map((k) => (
              <div key={k.label} className="text-xs">
                <div className="mb-1 flex justify-between">
                  <span>{k.label}</span>
                  <span className="text-muted-foreground">{k.n}</span>
                </div>
                <div className="h-2 rounded bg-muted">
                  <div
                    className="h-2 rounded bg-destructive"
                    style={{
                      width: `${(k.n / Math.max(1, ...ngPerKategori.map((x) => x.n))) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="X-Chart Dimensi">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <label className="text-muted-foreground">Produk</label>
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={chartProduct}
            onChange={(e) => {
              setChartProduct(e.target.value);
              setChartParam("__ALL__");
            }}
          >
            <option value="__ALL__">Semua Produk</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
          <label className="text-muted-foreground">Parameter</label>
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={chartParam}
            onChange={(e) => setChartParam(e.target.value)}
          >
            <option value="__ALL__">Semua Parameter</option>
            {paramOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          {[
            { v: 7, l: "1 Minggu" },
            { v: 30, l: "1 Bulan" },
            { v: 90, l: "3 Bulan" },
            { v: 0, l: "Semua" },
          ].map((r) => (
            <button
              key={r.v}
              onClick={() => setRange(r.v)}
              className={`rounded-md border px-2 py-1 ${
                range === r.v
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              {r.l}
            </button>
          ))}
        </div>

        <div className="h-44 w-full max-w-2xl">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                {activeStd && (
                  <>
                    <ReferenceLine
                      y={Number(activeStd.nilai_standar)}
                      stroke="currentColor"
                      className="text-muted-foreground"
                      strokeDasharray="4 4"
                    />
                    <ReferenceLine
                      y={Number(activeStd.nilai_standar) + Number(activeStd.toleransi_max)}
                      stroke="var(--destructive)"
                    />
                    <ReferenceLine
                      y={Number(activeStd.nilai_standar) - Number(activeStd.toleransi_min)}
                      stroke="var(--destructive)"
                    />
                  </>
                )}
                <Line
                  type="monotone"
                  dataKey="nilai"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground">Belum ada data pengukuran dimensi.</p>
          )}
        </div>
      </Panel>

      <Panel title="Laporan Harian per Tanggal & Shift">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <label className="text-muted-foreground">Tanggal</label>
          <input
            type="date"
            className="rounded-md border border-input bg-background px-2 py-1"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
          />
          <label className="text-muted-foreground">Shift</label>
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={reportShift}
            onChange={(e) => setReportShift(e.target.value)}
          >
            <option value="__ALL__">Semua Shift</option>
            {SHIFTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            disabled={!dailyRows.length}
            onClick={() => printReport(dailyRows, dailyTitle)}
          >
            Print
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!dailyRows.length}
            onClick={() => downloadReportPdf(dailyRows, dailyTitle)}
          >
            Download PDF
          </Button>
        </div>
        {!dailyRows.length ? (
          <p className="text-sm text-muted-foreground">
            Tidak ada inspeksi pada tanggal/shift ini.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {dailyRows.length} inspeksi · {dailyLulus} Lulus · {dailyGagal} Gagal. Laporan berisi
            ringkasan plus detail aktual per point (dimensi: angka, visual/fungsi: OK/NG).
          </p>
        )}
      </Panel>

      <Panel title="Inspeksi Terbaru">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <label className="text-muted-foreground">Filter Produk</label>
          <select
            className="rounded-md border border-input bg-background px-2 py-1"
            value={tableProduct}
            onChange={(e) => setTableProduct(e.target.value)}
          >
            <option value="All">Semua Produk</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nama}
              </option>
            ))}
          </select>
          <span className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => printReport(reportRows())}>
            Print
          </Button>
          <Button size="sm" variant="outline" onClick={() => downloadReportPdf(reportRows())}>
            Download PDF
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {[
                  "Tanggal",
                  "Shift",
                  "Sesi",
                  "Produk",
                  "Inspector",
                  "Sample",
                  "Dimensi",
                  "Visual",
                  "Fungsi",
                  "Hasil",
                  "Approve",
                  "",
                ].map((h) => (
                  <th key={h} className="py-2 pr-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredRows.slice(0, 50).map((i: Inspection) => (
                <tr key={i.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">{i.tanggal}</td>
                  <td className="py-2 pr-3">{i.shift}</td>
                  <td className="py-2 pr-3">{i.sesi}</td>
                  <td className="py-2 pr-3">{productName(i.product_id)}</td>
                  <td className="py-2 pr-3">{inspectorName(i.inspector_id)}</td>
                  <td className="py-2 pr-3">{i.sample}</td>
                  <td className="py-2 pr-3">{i.dimensi?.hasil}</td>
                  <td className="py-2 pr-3">{i.visual?.hasil}</td>
                  <td className="py-2 pr-3">{i.fungsi?.hasil}</td>
                  <td
                    className={`py-2 pr-3 font-medium ${
                      i.hasil_akhir === "Lulus" ? "text-primary" : "text-destructive"
                    }`}
                  >
                    {i.hasil_akhir}
                  </td>
                  <td className="py-2 pr-3">
                    <Button
                      size="sm"
                      variant={i.approved ? "secondary" : "outline"}
                      onClick={() =>
                        mutate.mutate(() =>
                          updateRow("inspections", i.id, { approved: !i.approved }),
                        )
                      }
                    >
                      {i.approved ? "Approved" : "Approve"}
                    </Button>
                  </td>
                  <td className="py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => mutate.mutate(() => deleteRow("inspections", i.id))}
                    >
                      Hapus
                    </Button>
                  </td>
                </tr>
              ))}
              {!filteredRows.length && (
                <tr>
                  <td colSpan={12} className="py-4 text-muted-foreground">
                    Belum ada inspeksi.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </AppShell>
  );
}
