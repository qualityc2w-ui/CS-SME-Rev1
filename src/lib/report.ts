import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Inspection } from "@/lib/qc";

export type ReportRow = {
  inspection: Inspection;
  produk: string;
  inspector: string;
};

const HEAD = [
  "Tanggal",
  "Produk",
  "Inspector",
  "Shift",
  "Sesi",
  "Sample",
  "Dimensi",
  "Visual",
  "Fungsi",
  "Hasil",
  "Bukti",
];

function evidenceCount(i: Inspection) {
  return Array.isArray(i.evidence) ? i.evidence.length : 0;
}

function toCells(r: ReportRow) {
  const i = r.inspection;
  const n = evidenceCount(i);
  return [
    i.tanggal,
    r.produk,
    r.inspector,
    i.shift,
    i.sesi,
    String(i.sample),
    i.dimensi?.hasil ?? "-",
    i.visual?.hasil ?? "-",
    i.fungsi?.hasil ?? "-",
    i.hasil_akhir,
    n ? `${n} foto` : "-",
  ];
}

type DetailLine = [string, string, string, string]; // Bagian, Point, Hasil Aktual, Status/Catatan

function detailLines(r: ReportRow): DetailLine[] {
  const i = r.inspection;
  const lines: DetailLine[] = [];
  for (const d of i.dimensi?.detail ?? []) {
    const aktual =
      d.nilai === null || d.nilai === undefined || Number.isNaN(d.nilai)
        ? "-"
        : `${d.nilai} ${d.satuan ?? ""}`.trim();
    const standar = `${d.standar} (${d.min}–${d.max}) ${d.satuan ?? ""}`.trim();
    lines.push([
      "Dimensi",
      `${d.parameter} [std ${standar}]`,
      aktual,
      d.hasil,
    ]);
  }
  if (i.visual) {
    lines.push([
      "Visual",
      "Pengecekan visual",
      i.visual.hasil,
      i.visual.catatan?.trim() || "-",
    ]);
  }
  if (i.fungsi) {
    lines.push([
      "Fungsi",
      "Pengecekan fungsi",
      i.fungsi.hasil,
      i.fungsi.catatan?.trim() || "-",
    ]);
  }
  return lines;
}

export function downloadReportPdf(rows: ReportRow[], judul = "Laporan Inspeksi QC") {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text(judul, 40, 40);
  doc.setFontSize(9);
  doc.text(`Dicetak: ${new Date().toLocaleString("id-ID")} · ${rows.length} data`, 40, 56);

  // Tabel ringkasan
  autoTable(doc, {
    startY: 70,
    head: [HEAD],
    body: rows.map(toCells),
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: { fillColor: [30, 41, 59] },
    didParseCell: (d) => {
      if (d.section === "body" && d.column.index === 9 && d.cell.raw === "Gagal") {
        d.cell.styles.textColor = [190, 30, 45];
        d.cell.styles.fontStyle = "bold";
      }
    },
  });

  // Detail per inspeksi
  let y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 24;
  rows.forEach((r, idx) => {
    const i = r.inspection;
    const lines = detailLines(r);
    if (!lines.length) return;
    if (y > doc.internal.pageSize.getHeight() - 120) {
      doc.addPage();
      y = 40;
    }
    doc.setFontSize(10);
    doc.text(
      `${idx + 1}. ${i.tanggal} · ${r.produk} · ${r.inspector} · ${i.shift}/${i.sesi} · Hasil: ${i.hasil_akhir}`,
      40,
      y,
    );
    autoTable(doc, {
      startY: y + 8,
      head: [["Bagian", "Point Pengecekan", "Hasil Aktual", "Status / Catatan"]],
      body: lines,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [71, 85, 105] },
      columnStyles: { 0: { cellWidth: 60 }, 2: { cellWidth: 110 } },
      didParseCell: (d) => {
        if (d.section === "body" && d.cell.raw === "NG") {
          d.cell.styles.textColor = [190, 30, 45];
          d.cell.styles.fontStyle = "bold";
        }
      },
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;
  });

  doc.save(`${judul.toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export function printReport(rows: ReportRow[], judul = "Laporan Inspeksi QC") {
  const win = window.open("", "_blank", "width=1100,height=800");
  if (!win) return;
  const body = rows
    .map(
      (r) =>
        `<tr>${toCells(r)
          .map((c, idx) => `<td class="${idx === 9 && c === "Gagal" ? "ng" : ""}">${c}</td>`)
          .join("")}</tr>`,
    )
    .join("");
  const details = rows
    .map((r, idx) => {
      const i = r.inspection;
      const lines = detailLines(r);
      if (!lines.length) return "";
      const rowsHtml = lines
        .map(
          (l) =>
            `<tr><td>${l[0]}</td><td>${l[1]}</td><td>${l[2]}</td><td class="${l.includes("NG") ? "ng" : ""}">${l[3]}</td></tr>`,
        )
        .join("");
      return `<h2>${idx + 1}. ${i.tanggal} · ${r.produk} · ${r.inspector} · ${i.shift}/${i.sesi} · Hasil: ${i.hasil_akhir}</h2>
      <table><thead><tr><th>Bagian</th><th>Point Pengecekan</th><th>Hasil Aktual</th><th>Status / Catatan</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
    })
    .join("");
  win.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${judul}</title>
  <style>
    body{font-family:system-ui,Arial,sans-serif;margin:24px;color:#111}
    h1{font-size:18px;margin:0 0 4px}
    h2{font-size:13px;margin:20px 0 6px}
    p{font-size:12px;color:#555;margin:0 0 16px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #ccc;padding:6px;text-align:left}
    th{background:#1e293b;color:#fff}
    .ng{color:#be1e2d;font-weight:700}
    @media print{@page{size:A4 landscape;margin:12mm}}
  </style></head><body>
  <h1>${judul}</h1>
  <p>Dicetak: ${new Date().toLocaleString("id-ID")} · ${rows.length} data</p>
  <table><thead><tr>${HEAD.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table>
  ${details}
  <script>window.onload=()=>{window.print()}<\/script>
  </body></html>`);
  win.document.close();
}
