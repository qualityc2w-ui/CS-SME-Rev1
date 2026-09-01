import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QC Inspect — Sistem Inspeksi Kualitas Produk" },
      {
        name: "description",
        content:
          "Masuk ke QC Inspect untuk mencatat inspeksi dimensi, visual, dan fungsi produk serta memantau dashboard kualitas.",
      },
      { property: "og:title", content: "QC Inspect — Sistem Inspeksi Kualitas" },
      {
        property: "og:description",
        content: "Sistem inspeksi kualitas produk dengan kontrol akses per peran.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard", replace: true });
  }, [loading, session, navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <ShieldCheck className="size-7" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">QC Inspect</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Sistem inspeksi kualitas produk. Data inspeksi hanya dapat diakses oleh pengguna
          terdaftar sesuai perannya (admin, QC, karyawan).
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild>
            <Link to="/auth">Masuk</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
