import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/qc/AppShell";
import { InstruksiImage } from "@/components/qc/InstruksiImage";
import {
  qcQueries,
  picQuery,
  insertRow,
  deleteRow,
  dimensiEvaluate,
  uploadEvidence,
  refreshEvidenceUrl,
  buildNgMessage,
  waLink,
  normalizeWa,
  SESI,
  SHIFTS,
  today,
  type DimensiDetail,
  type Evidence,
} from "@/lib/qc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { downloadReportPdf, printReport } from "@/lib/report";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/input")({
  head: () => ({
    meta: [
      { title: "Input Data Inspeksi — QC Inspect" },
      {
        name: "description",
        content:
          "Catat hasil pemeriksaan dimensi, visual, dan fungsi produk per shift dan sesi pengecekan.",
      },
      { property: "og:title", content: "Input Data Inspeksi — QC Inspect" },
      {
        property: "og:description",
        content: "Form pencatatan hasil inspeksi kualitas: dimensi, visual, dan fungsi.",
      },
    ],
  }),
  component: InputPage,
});

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5">
      {title && (
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}

function InputPage() {
  const qc = useQueryClient();
  const { data: products = [] } = useQuery(qcQueries.products());
  const { data: inspectors = [] } = useQuery(qcQueries.inspectors());
  const { data: defects = [] } = useQuery(qcQueries.defects());
  const { data: standards = [] } = useQuery(qcQueries.dimensionStandards());
  const { data: visualStd = [] } = useQuery(qcQueries.visualStandards());
  const { data: fungsiStd = [] } = useQuery(qcQueries.functionStandards());
  const { data: inspections = [] } = useQuery(qcQueries.inspections());
  const { data: pics = [] } = useQuery(picQuery());
  const [waShare, setWaShare] = useState<{
    message: string;
    targets: { nomor: string; nama: string }[];
  } | null>(null);
  const [tanggal, setTanggal] = useState(today());
  const [productId, setProductId] = useState("");
  const [inspectorId, setInspectorId] = useState("");
  const [shift, setShift] = useState(SHIFTS[0] ?? "Shift 1");
  const [sesi, setSesi] = useState(SESI[0] ?? "Start");
  const [sample, setSample] = useState(30);
  const [values, setValues] = useState<Record<string, string>>({});
  const [visual, setVisual] = useState({ hasil: "OK", defectId: "", catatan: "" });
  const [fungsi, setFungsi] = useState({ hasil: "OK", defectId: "", catatan: "" });
  const [visualItems, setVisualItems] = useState<Record<string, "OK" | "NG">>({});
  const [fungsiItems, setFungsiItems] = useState<Record<string, "OK" | "NG">>({});
  const [files, setFiles] = useState<File[]>([]);

  const activeProduct = productId || products[0]?.id || "";
  const activeInspector = inspectorId || inspectors[0]?.id || "";
  const productStandards = useMemo(
    () => standards.filter((s) => s.product_id === activeProduct),
    [standards, activeProduct],
  );
  const visualChecklist = useMemo(
    () => visualStd.filter((v) => v.product_id === activeProduct),
    [visualStd, activeProduct],
  );
  const fungsiChecklist = useMemo(
    () => fungsiStd.filter((v) => v.product_id === activeProduct),
    [fungsiStd, activeProduct],
  );

  const dimensiDetail: DimensiDetail[] = useMemo(
    () =>
      productStandards.map((s) => {
        const raw = values[s.id];
        const nilai = raw === undefined || raw === "" ? null : Number(raw);
        return {
          parameter: s.parameter,
          nilai,
          standar: Number(s.nilai_standar),
          min: Number(s.nilai_standar) - Number(s.toleransi_min),
          max: Number(s.nilai_standar) + Number(s.toleransi_max),
          satuan: s.satuan,
          hasil: dimensiEvaluate(nilai, s),
        };
      }),
    [productStandards, values],
  );

  const visualDetail = visualChecklist.map((c) => ({
    checklist: c.checklist,
    hasil: visualItems[c.id] ?? "OK",
  }));
  const fungsiDetail = fungsiChecklist.map((c) => ({
    checklist: c.checklist,
    hasil: fungsiItems[c.id] ?? "OK",
  }));
  const visualHasil = visualChecklist.length
    ? visualDetail.some((d) => d.hasil === "NG")
      ? "NG"
      : "OK"
    : visual.hasil;
  const fungsiHasil = fungsiChecklist.length
    ? fungsiDetail.some((d) => d.hasil === "NG")
      ? "NG"
      : "OK"
    : fungsi.hasil;

  const dimensiTerisi = productStandards.some((s) => (values[s.id] ?? "") !== "");
  const dimensiHasil =
    dimensiTerisi && dimensiDetail.some((d) => d.hasil === "NG") ? "NG" : "OK";
  const bagianNg = [
    dimensiHasil === "NG" ? "Dimensi" : "",
    visualHasil === "NG" ? "Visual" : "",
    fungsiHasil === "NG" ? "Fungsi" : "",
  ].filter(Boolean);
  const adaNg = bagianNg.length > 0;
  const hasilAkhir = adaNg ? "Gagal" : "Lulus";

  const itemNg = [
    ...visualDetail.filter((d) => d.hasil === "NG").map((d) => `Visual: ${d.checklist}`),
    ...fungsiDetail.filter((d) => d.hasil === "NG").map((d) => `Fungsi: ${d.checklist}`),
  ];

  const save = useMutation({
    mutationFn: async () => {
      if (adaNg && files.length === 0) {
        throw new Error("Hasil NG wajib melampirkan minimal 1 foto bukti (evidence).");
      }
      const evidence: Evidence[] = files.length ? await uploadEvidence(files) : [];
      await insertRow("inspections", {
        tanggal,
        product_id: activeProduct || null,
        inspector_id: activeInspector || null,
        shift,
        sesi,
        sample,
        dimensi: { hasil: dimensiHasil, detail: dimensiDetail, defectId: "", catatan: "" },
        visual: { ...visual, hasil: visualHasil, detail: visualDetail },
        fungsi: { ...fungsi, hasil: fungsiHasil, detail: fungsiDetail },

        hasil_akhir: hasilAkhir,
        evidence,
      });
      return { evidence };
    },
    onSuccess: ({ evidence }) => {
      toast.success("Sesi pengecekan tersimpan");
      if (adaNg) {
        const produk = products.find((p) => p.id === activeProduct);
        const pesan = buildNgMessage({
          tanggal,
          produk: produk ? `${produk.kode} — ${produk.nama}` : "-",
          inspector: inspectors.find((i) => i.id === activeInspector)?.nama ?? "-",
          shift,
          sesi,
          bagian: bagianNg,
          catatan: [visual.catatan, fungsi.catatan].filter(Boolean).join(" | "),
          hasil: hasilAkhir,
          evidence: evidence.length,
        });
        const targets = new Map<string, string>();
        for (const p of pics) {
          const n = normalizeWa(p.nomor_wa ?? "");
          if (n) targets.set(n, `${p.nama} (PIC)`);
        }
        for (const i of inspectors) {
          const n = normalizeWa((i as { nomor_wa?: string }).nomor_wa ?? "");
          if (n && !targets.has(n)) targets.set(n, `${i.nama} (QC)`);
        }
        if (!targets.size) {
          toast.warning("Nomor WhatsApp PIC/QC belum diisi di Master Data.");
        } else {
          setWaShare({
            message: pesan,
            targets: Array.from(targets, ([nomor, nama]) => ({ nomor, nama })),
          });
        }
      }

      setValues({});
      setFiles([]);
      setVisual({ hasil: "OK", defectId: "", catatan: "" });
      setFungsi({ hasil: "OK", defectId: "", catatan: "" });
      qc.invalidateQueries({ queryKey: ["inspections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const remove = useMutation({
    mutationFn: (id: string) => deleteRow("inspections", id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inspections"] }),
  });

  const CheckCard = ({
    title,
    state,
    setState,
    tipe,
    checklist,
    items,
    setItems,
  }: {
    title: string;
    state: { hasil: string; defectId: string; catatan: string };
    setState: (v: { hasil: string; defectId: string; catatan: string }) => void;
    tipe: string;
    checklist: { id: string; checklist: string; gambar_path?: string }[];
    items: Record<string, "OK" | "NG">;
    setItems: (v: Record<string, "OK" | "NG">) => void;
  }) => (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {checklist.length > 0 ? (
        <ul className="mb-3 space-y-2 rounded-md border border-border/60 bg-muted/30 p-2">
          {checklist.map((c) => {
            const val = items[c.id] ?? "OK";
            return (
              <li key={c.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex-1">{c.checklist}</span>
                <div className="flex gap-1">
                  {(["OK", "NG"] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setItems({ ...items, [c.id]: v })}
                      className={`rounded border px-2 py-0.5 font-semibold ${
                        val === v
                          ? v === "OK"
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-destructive bg-destructive text-destructive-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          Belum ada checklist {title.toLowerCase()} untuk produk ini (tambahkan di Master Data).
        </p>
      )}
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Hasil</Label>
          <select
            className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-70"
            value={state.hasil}
            disabled={checklist.length > 0}
            onChange={(e) => setState({ ...state, hasil: e.target.value })}
          >
            <option value="OK">OK</option>
            <option value="NG">NG</option>
          </select>
          {checklist.length > 0 && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              Otomatis dari checklist di atas.
            </p>
          )}
        </div>
        {state.hasil === "NG" && (
          <>
            <div>
              <Label className="text-xs">Jenis Defect</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={state.defectId}
                onChange={(e) => setState({ ...state, defectId: e.target.value })}
              >
                <option value="">— Pilih —</option>
                {defects
                  .filter((d) => d.tipe === tipe)
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nama} ({d.kategori})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Catatan</Label>
              <Textarea
                rows={2}
                value={state.catatan}
                onChange={(e) => setState({ ...state, catatan: e.target.value })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );


  return (
    <AppShell title="Input Data Inspeksi" subtitle="Catat hasil pemeriksaan kualitas produk">
      <Panel>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label className="text-xs">Tanggal</Label>
              <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Produk</Label>
              <div className="flex items-center gap-2">
                <select
                  className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={activeProduct}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.kode} — {p.nama}
                    </option>
                  ))}
                </select>
                <InstruksiImage
                  path={products.find((p) => p.id === activeProduct)?.gambar_path}
                  alt="Gambar instruksi produk"
                  size={40}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Inspector</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={activeInspector}
                onChange={(e) => setInspectorId(e.target.value)}
              >
                {inspectors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nama}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Shift</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={shift}
                onChange={(e) => setShift(e.target.value)}
              >
                {SHIFTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Sesi Pengecekan</Label>
              <select
                className="mt-1 h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={sesi}
                onChange={(e) => setSesi(e.target.value)}
              >
                {SESI.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs">Jumlah Sample</Label>
              <Input
                type="number"
                min={1}
                value={sample}
                onChange={(e) => setSample(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-border p-4">
              <h3 className="mb-3 text-sm font-semibold">Dimensi Part</h3>
              {productStandards.length ? (
                <div className="space-y-3">
                  {productStandards.map((s) => {
                    const raw = values[s.id] ?? "";
                    const nilai = raw === "" ? null : Number(raw);
                    const hasil = raw === "" ? null : dimensiEvaluate(nilai, s);
                    return (
                      <div key={s.id}>
                        <Label className="text-xs">
                          {s.parameter} ({Number(s.nilai_standar)} −{Number(s.toleransi_min)}/+
                          {Number(s.toleransi_max)} {s.satuan})
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            step="any"
                            value={raw}
                            onChange={(e) => setValues({ ...values, [s.id]: e.target.value })}
                          />
                          {hasil && (
                            <span
                              className={`text-xs font-semibold ${
                                hasil === "OK" ? "text-primary" : "text-destructive"
                              }`}
                            >
                              {hasil}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Belum ada standard dimensi untuk produk ini.
                </p>
              )}
            </div>

            <CheckCard
              title="Visual Part"
              state={visual}
              setState={setVisual}
              tipe="Visual"
              checklist={visualStd.filter((v) => v.product_id === activeProduct)}
            />
            <CheckCard
              title="Fungsi Part"
              state={fungsi}
              setState={setFungsi}
              tipe="Fungsi"
              checklist={fungsiStd.filter((v) => v.product_id === activeProduct)}
            />
          </div>

          <div
            className={`rounded-lg border p-4 ${
              adaNg && files.length === 0 ? "border-destructive" : "border-border"
            }`}
          >
            <h3 className="mb-1 text-sm font-semibold">
              Foto Bukti (Evidence){adaNg && <span className="text-destructive"> *wajib</span>}
            </h3>
            <p className="mb-3 text-xs text-muted-foreground">
              {adaNg
                ? `Terdeteksi NG pada: ${bagianNg.join(", ")}. Lampirkan minimal 1 foto bukti sebelum menyimpan.`
                : "Opsional saat hasil OK. Wajib bila ada hasil NG."}
            </p>
            <Input
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
            {files.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {files.map((f) => (
                  <li key={f.name}>• {f.name}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Menyimpan…" : "Simpan Sesi Pengecekan"}
            </Button>
            <span className="text-xs text-muted-foreground">
              Hasil akhir saat ini:{" "}
              <b className={adaNg ? "text-destructive" : "text-primary"}>{hasilAkhir}</b>
            </span>
          </div>
        </form>
      </Panel>

      <Panel title="Riwayat Inspeksi">
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              printReport(
                inspections.slice(0, 100).map((i) => ({
                  inspection: i,
                  produk: products.find((p) => p.id === i.product_id)?.nama ?? "—",
                  inspector: inspectors.find((n) => n.id === i.inspector_id)?.nama ?? "—",
                })),
              )
            }
          >
            Print
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              downloadReportPdf(
                inspections.slice(0, 100).map((i) => ({
                  inspection: i,
                  produk: products.find((p) => p.id === i.product_id)?.nama ?? "—",
                  inspector: inspectors.find((n) => n.id === i.inspector_id)?.nama ?? "—",
                })),
              )
            }
          >
            Download PDF
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {["Tanggal", "Shift", "Sesi", "Produk", "Sample", "Dimensi", "Visual", "Fungsi", "Hasil", "Bukti", ""].map(
                  (h) => (
                    <th key={h} className="py-2 pr-3 font-medium">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {inspections.slice(0, 30).map((i) => (
                <tr key={i.id} className="border-b border-border/60">
                  <td className="py-2 pr-3">{i.tanggal}</td>
                  <td className="py-2 pr-3">{i.shift}</td>
                  <td className="py-2 pr-3">{i.sesi}</td>
                  <td className="py-2 pr-3">
                    {products.find((p) => p.id === i.product_id)?.nama ?? "—"}
                  </td>
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
                    {(i.evidence ?? []).length ? (
                      <button
                        type="button"
                        className="text-primary underline"
                        onClick={async () => {
                          const url = await refreshEvidenceUrl(i.evidence![0]!.path);
                          if (url) window.open(url, "_blank");
                        }}
                      >
                        {i.evidence!.length} foto
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>

                  <td className="py-2">
                    <Button size="sm" variant="ghost" onClick={() => remove.mutate(i.id)}>
                      Hapus
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Dialog open={!!waShare} onOpenChange={(open) => !open && setWaShare(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hasil NG — Bagikan ke WhatsApp</DialogTitle>
            <DialogDescription>
              Pesan notifikasi sudah disiapkan. Klik nama penerima untuk membuka WhatsApp dan
              mengirim.
            </DialogDescription>
          </DialogHeader>
          {waShare && (
            <div className="space-y-2">
              {waShare.targets.map((t) => (
                <Button
                  key={t.nomor}
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => window.open(waLink(t.nomor, waShare.message), "_blank")}
                >
                  <span>{t.nama}</span>
                  <span className="text-xs text-muted-foreground">+{t.nomor}</span>
                </Button>
              ))}
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  for (const t of waShare.targets) {
                    window.open(waLink(t.nomor, waShare.message), "_blank");
                  }
                }}
              >
                Kirim ke Semua
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Jika tombol "Kirim ke Semua" terblokir browser, kirim satu per satu lewat tombol
                nama di atas.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
