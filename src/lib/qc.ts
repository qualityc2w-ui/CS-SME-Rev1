import { supabase } from "@/integrations/supabase/client";

export type Product = { id: string; kode: string; nama: string; gambar_path?: string };
export type Inspector = { id: string; nama: string; dept: string; nomor_wa?: string };
export type Defect = { id: string; nama: string; tipe: string; kategori: string };
export type DimensionStandard = {
  id: string;
  product_id: string;
  parameter: string;
  nilai_standar: number;
  toleransi_min: number;
  toleransi_max: number;
  satuan: string;
  gambar_path?: string;
};
export type SimpleStandard = {
  id: string;
  product_id: string;
  checklist: string;
  gambar_path?: string;
};

export type DimensiDetail = {
  parameter: string;
  nilai: number | null;
  standar: number;
  min: number;
  max: number;
  satuan: string;
  hasil: "OK" | "NG";
};
export type DimensiPart = {
  hasil: "OK" | "NG";
  detail: DimensiDetail[];
  defectId: string;
  catatan: string;
};
export type SimplePart = { hasil: "OK" | "NG"; defectId: string; catatan: string };

export type Inspection = {
  id: string;
  tanggal: string;
  product_id: string | null;
  inspector_id: string | null;
  shift: string;
  sesi: string;
  sample: number;
  dimensi: DimensiPart;
  visual: SimplePart;
  fungsi: SimplePart;
  hasil_akhir: string;
  evidence?: Evidence[];
  approved: boolean;
  created_at: string;
};

export const SHIFTS = ["Shift 1", "Shift 2"];
export const SESI = ["Start", "Middle", "End"];

export const today = () => new Date().toISOString().slice(0, 10);

async function list<T>(table: string, order = "created_at"): Promise<T[]> {
  const { data, error } = await supabase.from(table as never).select("*").order(order);
  if (error) throw error;
  return (data ?? []) as T[];
}

export const qcQueries = {
  products: () => ({ queryKey: ["products"], queryFn: () => list<Product>("products", "kode") }),
  inspectors: () => ({ queryKey: ["inspectors"], queryFn: () => list<Inspector>("inspectors", "nama") }),
  defects: () => ({ queryKey: ["defects"], queryFn: () => list<Defect>("defects", "nama") }),
  dimensionStandards: () => ({
    queryKey: ["dimension_standards"],
    queryFn: () => list<DimensionStandard>("dimension_standards"),
  }),
  visualStandards: () => ({
    queryKey: ["visual_standards"],
    queryFn: () => list<SimpleStandard>("visual_standards"),
  }),
  functionStandards: () => ({
    queryKey: ["function_standards"],
    queryFn: () => list<SimpleStandard>("function_standards"),
  }),
  inspections: () => ({
    queryKey: ["inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspections")
        .select("*")
        .order("tanggal", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Inspection[];
    },
  }),
};

export async function insertRow(table: string, values: Record<string, unknown>) {
  const { error } = await supabase.from(table as never).insert(values as never);
  if (error) throw error;
}

export async function updateRow(table: string, id: string, values: Record<string, unknown>) {
  const { error } = await supabase.from(table as never).update(values as never).eq("id", id);
  if (error) throw error;
}

export async function deleteRow(table: string, id: string) {
  const { error } = await supabase.from(table as never).delete().eq("id", id);
  if (error) throw error;
}

export function dimensiEvaluate(
  nilai: number | null,
  std: DimensionStandard,
): "OK" | "NG" {
  if (nilai === null || Number.isNaN(nilai)) return "NG";
  const min = Number(std.nilai_standar) - Number(std.toleransi_min);
  const max = Number(std.nilai_standar) + Number(std.toleransi_max);
  return nilai >= min && nilai <= max ? "OK" : "NG";
}

export type Evidence = { url: string; path: string; nama: string };
export type PicAccount = { id: string; nama: string; role: string; nomor_wa: string };

export const picQuery = () => ({
  queryKey: ["pic_accounts"],
  queryFn: () => list<PicAccount>("pic_accounts", "nama"),
});

/** Upload foto bukti NG ke storage privat, lalu ambil signed URL berumur panjang. */
export async function uploadEvidence(files: File[]): Promise<Evidence[]> {
  const out: Evidence[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("evidence").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    const { data } = await supabase.storage
      .from("evidence")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    out.push({ path, url: data?.signedUrl ?? "", nama: file.name });
  }
  return out;
}

export async function refreshEvidenceUrl(path: string) {
  const { data } = await supabase.storage.from("evidence").createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? "";
}

export function normalizeWa(no: string) {
  const digits = (no ?? "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  if (digits.startsWith("62")) return digits;
  return digits;
}

export function buildNgMessage(p: {
  tanggal: string;
  produk: string;
  inspector: string;
  shift: string;
  sesi: string;
  bagian: string[];
  catatan: string;
  hasil: string;
  evidence: number;
}) {
  return [
    "*NOTIFIKASI QC INSPECT*",
    `Hasil: *${p.hasil}*`,
    `Tanggal: ${p.tanggal}`,
    `Produk: ${p.produk}`,
    `Shift/Sesi: ${p.shift} / ${p.sesi}`,
    `Inspector: ${p.inspector}`,
    p.bagian.length ? `Bagian NG: ${p.bagian.join(", ")}` : "",
    p.catatan ? `Catatan: ${p.catatan}` : "",
    `Foto bukti: ${p.evidence} file`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function waLink(nomor: string, pesan: string) {
  return `https://wa.me/${normalizeWa(nomor)}?text=${encodeURIComponent(pesan)}`;
}

/** Upload gambar instruksi pengecekan ke bucket privat `instruksi`. */
export async function uploadInstruksi(file: File): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("instruksi").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function instruksiUrl(path: string) {
  if (!path) return "";
  const { data } = await supabase.storage.from("instruksi").createSignedUrl(path, 60 * 60 * 8);
  return data?.signedUrl ?? "";
}
