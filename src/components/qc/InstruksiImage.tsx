import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { instruksiUrl } from "@/lib/qc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Thumbnail gambar instruksi pengecekan; klik untuk memperbesar. */
export function InstruksiImage({
  path,
  alt,
  size = 48,
}: {
  path?: string | null | undefined;
  alt: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const { data: url } = useQuery({
    queryKey: ["instruksi-url", path],
    queryFn: () => instruksiUrl(path as string),
    enabled: !!path,
    staleTime: 1000 * 60 * 30,
  });

  if (!path) return null;
  if (!url)
    return (
      <div
        className="shrink-0 animate-pulse rounded border border-border bg-muted"
        style={{ width: size, height: size }}
      />
    );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 overflow-hidden rounded border border-border transition hover:ring-2 hover:ring-primary"
        style={{ width: size, height: size }}
        title={`Lihat instruksi: ${alt}`}
      >
        <img src={url} alt={`Instruksi pengecekan ${alt}`} className="h-full w-full object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Instruksi pengecekan — {alt}</DialogTitle>
          </DialogHeader>
          <img src={url} alt={`Instruksi pengecekan ${alt}`} className="w-full rounded" />
        </DialogContent>
      </Dialog>
    </>
  );
}
